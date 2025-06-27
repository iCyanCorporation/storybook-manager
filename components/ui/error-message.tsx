interface ErrorMessageProps {
  message: string;
  size?: "sm" | "md" | "lg";
}

export function ErrorMessage({ message, size = "md" }: ErrorMessageProps) {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className={`${sizeClasses[size]} text-red-500 dark:text-red-400`}>
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="text-xl text-red-500 dark:text-red-400">{message}</p>
    </div>
  );
}
