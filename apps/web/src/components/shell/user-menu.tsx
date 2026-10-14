"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserRound } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isApiError } from "@/features/auth/api/errors"
import { useLogout, useSession } from "@/features/auth/hooks"

function initials(name: string) {
  const letters = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return letters || "AF"
}

export function UserMenu() {
  const router = useRouter()
  const session = useSession()
  const logout = useLogout()
  const user = session.data?.user

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-8 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
              {user ? initials(user.name) : <UserRound className="size-3.5" aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">
            {user?.name ?? "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{user?.name ?? "Account"}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user?.email ?? "Session unavailable"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={logout.isPending || !user}
          onSelect={(event) => {
            event.preventDefault()
            void logout.mutateAsync().then(() => {
              router.replace("/login")
            }).catch(() => undefined)
          }}
        >
          {logout.isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
        {logout.isError ? (
          <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
            {isApiError(logout.error) ? logout.error.message : "Sign out failed."}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
