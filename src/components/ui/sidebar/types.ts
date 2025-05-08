
import { type VariantProps } from "class-variance-authority"
import { type sidebarMenuButtonVariants } from "./sidebar-menu"

export type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

export type SidebarMenuButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<any>
} & VariantProps<typeof sidebarMenuButtonVariants>

