import { ReactNode } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportExportCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  bullets: string[];
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export function ReportExportCard({ title, description, icon, bullets, onExportPdf, onExportExcel }: ReportExportCardProps) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-black text-foreground">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-2" onClick={onExportPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={onExportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}