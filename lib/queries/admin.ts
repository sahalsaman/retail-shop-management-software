import "server-only";
import { Types } from "mongoose";
import { connectCloudDB } from "@/lib/mongoose";
import { Shop, User, Invite } from "@/models";

export type AdminStats = {
  totalShops: number;
  activeShops: number;
  pendingInvites: number;
  totalOwners: number;
};

export type ShopListItem = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  branchCount: number;
  createdAt: Date;
};

export type InviteListItem = {
  id: string;
  email: string;
  ownerName: string;
  shopName: string;
  shopType: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: Date;
  invitedByName: string;
  acceptedAt: Date | null;
  createdShopId: string | null;
  token: string;
  createdAt: Date;
};

export async function adminStats(): Promise<AdminStats> {
  await connectCloudDB();
  const [totalShops, activeShops, pendingInvites, totalOwners] = await Promise.all([
    Shop.countDocuments({}),
    Shop.countDocuments({ isActive: true }),
    Invite.countDocuments({ status: "PENDING" }),
    User.countDocuments({ role: "OWNER" }),
  ]);
  return { totalShops, activeShops, pendingInvites, totalOwners };
}

export async function listShops(): Promise<ShopListItem[]> {
  await connectCloudDB();
  const shops = await Shop.find({})
    .sort({ createdAt: -1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        type: string;
        isActive: boolean;
        ownerId: Types.ObjectId;
        createdAt: Date;
      }>
    >();
  if (shops.length === 0) return [];

  const ownerIds = shops.map((s) => s.ownerId);
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("_id name email phone")
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        email: string;
        phone: string | null;
      }>
    >();
  const ownerMap = new Map(owners.map((o) => [String(o._id), o]));

  // branch counts in one aggregation
  const conn = await connectCloudDB();
  const branchCounts: Array<{ _id: Types.ObjectId; count: number }> = conn
    ? await conn.connection
        .collection("branches")
        .aggregate([
          { $match: { shopId: { $in: shops.map((s) => s._id) } } },
          { $group: { _id: "$shopId", count: { $sum: 1 } } },
        ])
        .toArray()
        .then((rows) => rows as Array<{ _id: Types.ObjectId; count: number }>)
    : [];
  const branchMap = new Map(branchCounts.map((b) => [String(b._id), b.count]));

  return shops.map((s) => {
    const owner = ownerMap.get(String(s.ownerId));
    return {
      id: String(s._id),
      name: s.name,
      type: s.type,
      isActive: !!s.isActive,
      ownerName: owner?.name ?? "—",
      ownerEmail: owner?.email ?? "—",
      ownerPhone: owner?.phone ?? null,
      branchCount: branchMap.get(String(s._id)) ?? 0,
      createdAt: s.createdAt,
    };
  });
}

export async function listInvites(): Promise<InviteListItem[]> {
  await connectCloudDB();
  // Auto-expire stale invites on read so the list is always accurate.
  await Invite.updateMany(
    { status: "PENDING", expiresAt: { $lt: new Date() } },
    { $set: { status: "EXPIRED" } },
  );

  const docs = await Invite.find({})
    .sort({ createdAt: -1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        email: string;
        ownerName: string;
        shopName: string;
        shopType: string;
        status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
        expiresAt: Date;
        invitedBy: Types.ObjectId;
        acceptedAt: Date | null;
        createdShopId: Types.ObjectId | null;
        token: string;
        createdAt: Date;
      }>
    >();
  if (docs.length === 0) return [];

  const inviterIds = Array.from(new Set(docs.map((d) => String(d.invitedBy))));
  const inviters = await User.find({ _id: { $in: inviterIds } })
    .select("_id name")
    .lean<Array<{ _id: Types.ObjectId; name: string }>>();
  const inviterMap = new Map(inviters.map((i) => [String(i._id), i.name]));

  return docs.map((d) => ({
    id: String(d._id),
    email: d.email,
    ownerName: d.ownerName,
    shopName: d.shopName,
    shopType: d.shopType,
    status: d.status,
    expiresAt: d.expiresAt,
    invitedByName: inviterMap.get(String(d.invitedBy)) ?? "—",
    acceptedAt: d.acceptedAt ?? null,
    createdShopId: d.createdShopId ? String(d.createdShopId) : null,
    token: d.token,
    createdAt: d.createdAt,
  }));
}

export async function getInviteByToken(token: string) {
  await connectCloudDB();
  const doc = await Invite.findOne({ token }).lean<{
    _id: Types.ObjectId;
    email: string;
    ownerName: string;
    shopName: string;
    shopType: string;
    phone: string | null;
    status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
    expiresAt: Date;
  } | null>();
  if (!doc) return null;
  return {
    id: String(doc._id),
    email: doc.email,
    ownerName: doc.ownerName,
    shopName: doc.shopName,
    shopType: doc.shopType,
    phone: doc.phone ?? null,
    status: doc.status,
    expiresAt: doc.expiresAt,
  };
}
