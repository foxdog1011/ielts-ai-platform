import * as React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = ({
  className = '',
  error = false,
  ...props
}: TextareaProps) => {
  const baseStyles = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-500 transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const errorStyles = error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "";

  return (
    <textarea
      className={`${baseStyles} ${errorStyles} ${className}`.trim()}
      {...props}
    />
  );
};

export default Textarea;
