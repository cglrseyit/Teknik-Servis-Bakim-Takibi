import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn("grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }) {
  return (
    <div className={cn("leading-none font-semibold text-base", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props} />
  );
}

export function CardContent({ className, ...props }) {
  return (
    <div className={cn("px-6", className)} {...props} />
  );
}

export function CardFooter({ className, ...props }) {
  return (
    <div className={cn("flex items-center px-6", className)} {...props} />
  );
}
