import React from "react";

interface FlowArcIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function FlowArcIcon({ className = "", size = "md" }: FlowArcIconProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-9 h-9",
    lg: "w-12 h-12"
  };

  const finalClassName = className || sizeClasses[size];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${finalClassName} select-none`}
    >
      {/* Circular flow arc suggesting momentum and direction */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="url(#flowArcGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="36 18"
        className="animate-[spin_8s_linear_infinite]"
        style={{ transformOrigin: "center" }}
      />
      
      {/* Compass subtle direction/momentum ticks inside the arc */}
      <line x1="12" y1="5.5" x2="12" y2="6.5" stroke="var(--amber-400)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="17.5" x2="12" y2="18.5" stroke="var(--amber-400)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5.5" y1="12" x2="6.5" y2="12" stroke="var(--amber-400)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17.5" y1="12" x2="18.5" y2="12" stroke="var(--amber-400)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Diamond center point suggesting priority and decisiveness */}
      <path
        d="M12 7.5L16.5 12L12 16.5L7.5 12L12 7.5Z"
        fill="url(#diamondGradient)"
        className="animate-[pulse_3s_ease-in-out_infinite]"
        style={{ transformOrigin: "center" }}
      />
      
      <defs>
        <linearGradient id="flowArcGradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--flow-arc-stop1)" />
          <stop offset="1" stopColor="var(--flow-arc-stop2)" />
        </linearGradient>
        <linearGradient id="diamondGradient" x1="7.5" y1="7.5" x2="16.5" y2="16.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--flow-arc-stop2)" />
          <stop offset="1" stopColor="var(--flow-arc-stop1)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
