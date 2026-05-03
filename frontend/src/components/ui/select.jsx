import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ value, onValueChange, children, ...props }) {
  return (
    <div className="relative" {...props}>
      {children}
    </div>
  );
}

export function SelectTrigger({ className, children, id, value, onValueChange, placeholder, options = [], ...props }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={e => onValueChange?.(e.target.value)}
        className={cn(
          "border-input appearance-none flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none cursor-pointer",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 opacity-50" />
    </div>
  );
}

export function SelectValue({ placeholder }) {
  return null;
}

export function SelectContent({ children }) {
  return children;
}

export function SelectItem({ value, children }) {
  return null;
}

export function SelectGroup({ children }) {
  return children;
}

export function SelectLabel({ children }) {
  return null;
}

export function SelectSeparator() {
  return null;
}
