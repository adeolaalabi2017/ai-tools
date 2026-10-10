"use client";

import { LifeBuoyIcon, LogOutIcon, ShieldCheckIcon, UserIcon } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminNavigate } from "@/components/app-shared";

const moderator = {
  name: "AIS Moderator",
  email: "editors@aistore.dev",
  avatar: "",
};

export function NavUser({ onNavigate }: { onNavigate?: AdminNavigate }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Moderator menu"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <Avatar className="size-8">
            {moderator.avatar ? (
              <AvatarImage alt={moderator.name} src={moderator.avatar} />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-primary">
              <ShieldCheckIcon className="size-4" />
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem className="flex items-center justify-start gap-2">
          <DropdownMenuLabel className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/15 text-primary">
                <ShieldCheckIcon className="size-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="font-medium text-foreground">
                {moderator.name}
              </span>{" "}
              <br />
              <div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
                {moderator.email}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            Editor profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LifeBuoyIcon />
            Moderation guidelines
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="w-full cursor-pointer"
            onClick={() => onNavigate?.("discover")}
          >
            <LogOutIcon />
            Leave admin
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
