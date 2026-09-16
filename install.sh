#!/bin/sh
set -eu

REPO_URL=${REPO_URL:-https://github.com/alfahluzi/project-manager.git}
REF=${REF:-main}
SKILL_SUBDIR=${SKILL_SUBDIR:-.}
force=false
destination=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force) force=true ;;
    --destination=*) destination=${1#*=} ;;
    --destination)
      shift
      [ "$#" -gt 0 ] || { echo "--destination needs a path" >&2; exit 2; }
      destination=$1
      ;;
    --help|-h)
      echo "Usage: REPO_URL=... REF=... SKILL_SUBDIR=. $0 [--destination PATH] [--force]"
      exit 0
      ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

valid_destination() {
  case "$1" in
    .config/opencode/skills|*/.config/opencode/skills|.opencode/skills|*/.opencode/skills|.claude/skills|*/.claude/skills|.agents/skills|*/.agents/skills) return 0 ;;
    *) return 1 ;;
  esac
}

if [ -z "$destination" ]; then
  candidates=
  add_candidate() {
    case " $candidates " in *" $1 "*) ;; *) candidates="$candidates $1" ;; esac
  }
  for path in \
    .opencode/skills .claude/skills .agents/skills \
    "$HOME/.config/opencode/skills" "$HOME/.claude/skills" "$HOME/.agents/skills"; do
    [ -d "$path" ] && add_candidate "$path"
  done
  set -- $candidates
  [ "$#" -eq 1 ] || {
    echo "Ambiguous destination; use --destination PATH (or create exactly one supported skills directory)." >&2
    exit 2
  }
  destination=$1
fi

valid_destination "$destination" || {
  echo "Unsupported destination: $destination" >&2
  exit 2
}

check_no_symlinks() {
  current=$1
  while :; do
    [ -L "$current" ] && { echo "Refusing symlink path component: $current" >&2; exit 1; }
    parent=$(dirname "$current")
    [ "$parent" = "$current" ] && break
    current=$parent
  done
}

case "$SKILL_SUBDIR" in
  /*|../*|*/../*|*'/') echo "Invalid SKILL_SUBDIR: $SKILL_SUBDIR" >&2; exit 2 ;;
esac

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
archive="$tmp/package.tar.gz"
extracted="$tmp/extracted"
repo_base=${REPO_URL%.git}
curl -fsSL "$repo_base/archive/$REF.tar.gz" -o "$archive"
mkdir "$extracted"
tar -xzf "$archive" -C "$extracted"
set -- "$extracted"/*
[ "$#" -eq 1 ] && [ -d "$1" ] || {
  echo "Unexpected GitHub archive layout." >&2
  exit 1
}
archive_root=$1
source="$archive_root/$SKILL_SUBDIR"
[ -d "$source" ] && [ -f "$source/SKILL.md" ] || {
  echo "SKILL_SUBDIR does not contain SKILL.md: $SKILL_SUBDIR" >&2
  exit 1
}

target="$destination/project-manager"
check_no_symlinks "$destination"
check_no_symlinks "$target"
if [ -e "$target" ] && [ "$force" != true ]; then
  echo "Refusing overwrite: $target (use --force)." >&2
  exit 1
fi
staged="$tmp/project-manager"
mkdir "$staged"
cp -R "$source"/. "$staged"/
[ -f "$staged/SKILL.md" ] || { echo "Validated source could not be staged." >&2; exit 1; }

if [ "$force" = true ] && [ -e "$target" ]; then
  check_no_symlinks "$target"
  rm -rf "$target"
fi
mkdir -p "$destination"
check_no_symlinks "$destination"
if [ -e "$target" ]; then
  check_no_symlinks "$target"
fi
mv "$staged" "$target"
chmod +x "$target/bin/project-manager" "$target/scripts"/*.js 2>/dev/null || true
echo "Installed project-manager at $target"
