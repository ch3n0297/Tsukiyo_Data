import { Lock, Clock } from "lucide-react";

interface ComingSoonBlockProps {
  icon?: "lock" | "clock";
  title?: string;
  description?: string;
}

export function ComingSoonBlock({
  icon = "lock",
  title = "即將推出",
  description = "此功能需要後端 API 支援，開發中。",
}: ComingSoonBlockProps) {
  const Icon = icon === "clock" ? Clock : Lock;

  return (
    <div className="coming-soon-block">
      <Icon className="coming-soon-block__icon" aria-hidden="true" />
      <p className="coming-soon-block__title">{title}</p>
      <p className="coming-soon-block__desc">{description}</p>
      <span className="coming-soon-block__badge">Coming Soon</span>
    </div>
  );
}
