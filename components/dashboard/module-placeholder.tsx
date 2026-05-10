import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  title: string;
  description: string;
  features: string[];
  phase: string;
};

export function ModulePlaceholder({ title, description, features, phase }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          {phase}
        </Badge>
      </div>
      <Card>
        <CardContent className="py-10">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              This module is coming in {phase}. Planned features:
            </p>
            <ul className="text-sm text-left inline-block space-y-1">
              {features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
