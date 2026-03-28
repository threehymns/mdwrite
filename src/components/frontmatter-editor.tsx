import {
  BinaryCodeIcon,
  Calendar02Icon,
  Cancel01Icon,
  InputCursorTextIcon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PropertyType = "text" | "number" | "checkbox" | "date";

export interface Property {
  key: string;
  type: PropertyType;
  value: string | number | boolean;
}

interface InlineFrontmatterEditorProps {
  properties: Property[];
  onChange: (properties: Property[]) => void;
  onClose: () => void;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function frontmatterToProperties(
  frontmatter: Record<string, unknown>,
  existingProps: Property[] = [],
): Property[] {
  const existingByKey = new Map(existingProps.map((p) => [p.key, p]));
  return Object.entries(frontmatter).map(([key, value]) => {
    const existing = existingByKey.get(key);
    return {
      key,
      type:
        existing?.type ??
        (typeof value === "boolean"
          ? "checkbox"
          : typeof value === "number"
            ? "number"
            : typeof value === "string" && DATE_PATTERN.test(value)
              ? "date"
              : "text"),
      value: value as string | number | boolean,
    };
  });
}

export function serializeProperties(properties: Property[]): string {
  const validProps = properties.filter((p) => p.key.trim() !== "");
  if (validProps.length === 0) return "";

  const lines: string[] = [];
  for (const prop of validProps) {
    const { key, type, value } = prop;
    switch (type) {
      case "checkbox":
        lines.push(`${key}: ${value ? "true" : "false"}`);
        break;
      case "number":
        lines.push(`${key}: ${value}`);
        break;
      default:
        lines.push(`${key}: '${value}'`);
        break;
    }
  }

  return `---\n${lines.join("\n")}\n---\n`;
}

export function InlineFrontmatterEditor({
  properties,
  onChange,
  onClose,
}: InlineFrontmatterEditorProps) {
  const handleKeyChange = (index: number, newKey: string) => {
    const newProps = [...properties];
    newProps[index] = { ...newProps[index], key: newKey };
    onChange(newProps);
  };

  const handleValueChange = (
    index: number,
    newValue: string | number | boolean,
  ) => {
    const newProps = [...properties];
    newProps[index] = { ...newProps[index], value: newValue };
    onChange(newProps);
  };

  const handleTypeChange = (index: number, newType: PropertyType) => {
    const newProps = [...properties];
    const currentValue = newProps[index].value;
    let newValue: string | number | boolean = "";

    if (newType === "checkbox") {
      newValue = Boolean(currentValue);
    } else if (newType === "number") {
      newValue = typeof currentValue === "number" ? currentValue : 0;
    } else {
      newValue = typeof currentValue === "string" ? currentValue : "";
    }

    newProps[index] = { ...newProps[index], type: newType, value: newValue };
    onChange(newProps);
  };

  const addProperty = () => {
    onChange([...properties, { key: "", type: "text", value: "" }]);
  };

  const removeProperty = (index: number) => {
    onChange(properties.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addProperty();
    }
    if (
      e.key === "Backspace" &&
      properties[index].key === "" &&
      properties[index].value === ""
    ) {
      e.preventDefault();
      removeProperty(index);
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="border-border border-b bg-muted/20">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-2">
        {properties.map((prop, index) => (
          <div
            key={prop.key || index}
            className="group flex items-center gap-2 rounded-md focus-within:bg-muted/50 focus-within:ring-2 focus-within:ring-border"
          >
            <Select
              value={prop.type}
              onValueChange={(value) =>
                handleTypeChange(index, value as PropertyType)
              }
            >
              <Tooltip>
                <TooltipTrigger>
                  <SelectTrigger
                    className="h-7 w-7 border-none bg-transparent p-0 [&_svg]:hidden"
                    asChild
                  >
                    <Button
                      className="[&_svg]:inline"
                      variant="ghost"
                      size="icon"
                    >
                      <HugeiconsIcon
                        icon={
                          prop.type === "text"
                            ? InputCursorTextIcon
                            : prop.type === "number"
                              ? BinaryCodeIcon
                              : prop.type === "checkbox"
                                ? Tick02Icon
                                : Calendar02Icon
                        }
                        className="block size-4"
                      />
                    </Button>
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Type: {prop.type}</p>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="text">
                  <HugeiconsIcon
                    icon={InputCursorTextIcon}
                    className="size-4"
                  />
                  text
                </SelectItem>
                <SelectItem value="number">
                  <HugeiconsIcon icon={BinaryCodeIcon} className="size-4" />
                  number
                </SelectItem>
                <SelectItem value="checkbox">
                  <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                  checkbox
                </SelectItem>
                <SelectItem value="date">
                  <HugeiconsIcon icon={Calendar02Icon} className="size-4" />
                  date
                </SelectItem>
              </SelectContent>
            </Select>
            <input
              type="text"
              value={prop.key}
              onChange={(e) => handleKeyChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder="key"
              className="min-w-24 border-none outline-none"
            />
            {prop.type === "checkbox" ? (
              <Checkbox
                checked={Boolean(prop.value)}
                onCheckedChange={(checked) =>
                  handleValueChange(index, checked === true)
                }
              />
            ) : prop.type === "number" ? (
              <Input
                type="number"
                value={String(prop.value)}
                onChange={(e) =>
                  handleValueChange(index, Number(e.target.value))
                }
                className="min-w-24"
              />
            ) : prop.type === "date" ? (
              <Popover>
                <PopoverTrigger>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-24 justify-start text-left font-normal"
                  >
                    {prop.value ? (
                      String(prop.value)
                    ) : (
                      <>
                        <HugeiconsIcon
                          icon={Calendar02Icon}
                          className="mr-2 h-4 w-4"
                        />
                        <span>Pick a date</span>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      prop.value ? new Date(String(prop.value)) : undefined
                    }
                    onSelect={(date) =>
                      handleValueChange(
                        index,
                        date ? date.toISOString().split("T")[0] : "",
                      )
                    }
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <input
                type="text"
                value={String(prop.value)}
                onChange={(e) => handleValueChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                placeholder="value"
                className="min-w-32 flex-1 outline-none"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="opacity-0 group-focus-within:opacity-100"
              onClick={() => removeProperty(index)}
            >
              <HugeiconsIcon icon={Cancel01Icon} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={addProperty}
          className="self-start"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="mr-2 h-4 w-4" />
          Add property
        </Button>
      </div>
    </div>
  );
}
