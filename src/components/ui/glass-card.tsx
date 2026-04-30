import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: string;
  variant?: "default" | "sm" | "service";
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, glowColor = "rgba(34, 197, 94, 0.15)", variant = "default", style, ...props }, ref) => {
    const padding = variant === "service" ? "p-[18px_22px]" : variant === "sm" ? "p-5" : "p-7";
    const radius = variant === "service" ? "rounded-[18px]" : variant === "sm" ? "rounded-[20px]" : "rounded-3xl";
    const hoverY = variant === "service" ? "hover:-translate-y-[3px]" : "hover:-translate-y-1.5";

    return (
      <div
        ref={ref}
        className={cn(
          "group relative cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
          radius,
          hoverY,
          "hover:scale-[1.02]",
          className
        )}
        style={style}
        {...props}
      >
        <div
          className={cn(
            "relative z-[2] bg-card border border-border",
            radius,
            padding,
            variant === "default" && "min-h-[200px]",
            variant === "sm" && "min-h-[140px]",
            "shadow-sm transition-all duration-500",
            "group-hover:shadow-md group-hover:border-border/80"
          )}
        >
          {children}
        </div>
        {/* Subtle glow via box-shadow instead of backdrop-filter */}
        <div
          className={cn("absolute z-[1] rounded-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-500",
            variant === "service" ? "w-[120px] h-[120px] -top-8 -right-8" :
            variant === "sm" ? "w-[150px] h-[150px] -top-10 -right-10" :
            "w-[250px] h-[250px] -top-[60px] -right-[60px]"
          )}
          style={{ background: glowColor, filter: "blur(60px)" }}
        />
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
