import { createElement, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, File, Folder, GitBranch, LoaderCircle, LocateFixed, Search, Settings, X } from 'lucide';

const icons = {
  settings: Settings, back: ChevronLeft, down: ChevronDown, right: ChevronRight,
  branch: GitBranch, folder: Folder, file: File, link: ExternalLink,
  search: Search, locate: LocateFixed, close: X, eye: Eye, eyeOff: EyeOff,
  loading: LoaderCircle,
} as const;
export type IconName = keyof typeof icons;

export function svgIcon(name: IconName, className = ''): SVGElement {
  return createElement(icons[name], { 'aria-hidden': 'true', focusable: 'false', class: 'lucide' + (className ? ' ' + className : '') });
}
