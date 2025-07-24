import * as React from "react";

export const Button = ({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      className="bg-blue-500 text-white px-4 py-2 rounded"
      {...props}
    >
      {children}
    </button>
  );
};
export default Button;