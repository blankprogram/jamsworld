import React, { forwardRef } from "react";

const XpButton = forwardRef(
  ({ type = "button", className, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={className || undefined}
      {...props}
    >
      {children}
    </button>
  ),
);

XpButton.displayName = "XpButton";

export default XpButton;
