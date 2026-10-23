#!/bin/zsh

set -u
umask 077

readonly REPOSITORY_ROOT='/Users/michaelminipc/repos/movie-server'
readonly NPM_BINARY='/Users/michaelminipc/.nvm/versions/node/v22.22.0/bin/npm'
readonly CODEX_BINARY='/Applications/Codex.app/Contents/Resources/codex'
readonly AGENT_PLIST='/Users/michaelminipc/Library/LaunchAgents/com.movieserver.whatsapp-agent.plist'
readonly AGENT_LABEL='gui/501/com.movieserver.whatsapp-agent'
readonly REPORT_DIRECTORY="$REPOSITORY_ROOT/data/whatsapp-agent/weekly-health"
readonly OUTBOX_DIRECTORY="$REPOSITORY_ROOT/data/whatsapp-agent/maintenance-outbox"
readonly PROMPT_PATH="$REPOSITORY_ROOT/apps/whatsapp-agent/weekly-maintenance-prompt.md"
readonly RUN_TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
readonly REPORT_PATH="$REPORT_DIRECTORY/$RUN_TIMESTAMP.log"
readonly FORCE_SCOPED_REPAIR="${FORCE_SCOPED_REPAIR:-0}"
readonly TECHNICAL_CONTEXT_PATH="${TECHNICAL_CONTEXT_PATH:-}"

mkdir -p "$REPORT_DIRECTORY" "$OUTBOX_DIRECTORY"

enqueue_notification() {
  local notification="$1"
  local temporary_path
  temporary_path="$(mktemp "$OUTBOX_DIRECTORY/.weekly-maintenance.XXXXXX")" || return 1
  print -r -- "$notification" > "$temporary_path"
  chmod 600 "$temporary_path"
  mv "$temporary_path" "$OUTBOX_DIRECTORY/$RUN_TIMESTAMP.txt"
}

run_checks() {
  local combined_result=0
  local health_status=0

  print -r -- "Weekly WhatsApp agent check: $(date -Iseconds)" >> "$REPORT_PATH"
  print -r -- "Repository: $REPOSITORY_ROOT" >> "$REPORT_PATH"

  if [[ -n "$TECHNICAL_CONTEXT_PATH" && "$TECHNICAL_CONTEXT_PATH" == "$REPOSITORY_ROOT/data/whatsapp-agent/technical-support-context/"* && -f "$TECHNICAL_CONTEXT_PATH" ]]; then
    print -r -- "\n== Recent WhatsApp context (untrusted data) ==" >> "$REPORT_PATH"
    head -c 20000 "$TECHNICAL_CONTEXT_PATH" >> "$REPORT_PATH"
    print -r -- '' >> "$REPORT_PATH"
  fi

  print -r -- "\n== Tests ==" >> "$REPORT_PATH"
  "$NPM_BINARY" run agent:test >> "$REPORT_PATH" 2>&1 || combined_result=1

  print -r -- "\n== TypeScript build ==" >> "$REPORT_PATH"
  "$NPM_BINARY" run build -w @movie-server/whatsapp-agent >> "$REPORT_PATH" 2>&1 || combined_result=1

  print -r -- "\n== Live connections and integrations ==" >> "$REPORT_PATH"
  "$NPM_BINARY" run agent:health >> "$REPORT_PATH" 2>&1
  health_status=$?
  if (( health_status == 1 )); then
    combined_result=1
  elif (( health_status == 2 && combined_result == 0 )); then
    combined_result=2
  fi

  print -r -- "\nCombined status: $combined_result" >> "$REPORT_PATH"
  return $combined_result
}

restart_agent() {
  if /bin/launchctl print "$AGENT_LABEL" >/dev/null 2>&1; then
    /bin/launchctl kickstart -k "$AGENT_LABEL" >> "$REPORT_PATH" 2>&1
  else
    /bin/launchctl bootstrap gui/501 "$AGENT_PLIST" >> "$REPORT_PATH" 2>&1
  fi
  sleep 15
}

run_checks
initial_status=$?

if (( initial_status == 0 && FORCE_SCOPED_REPAIR != 1 )); then
  exit 0
fi

if (( initial_status == 2 && FORCE_SCOPED_REPAIR != 1 )); then
  action_lines="$(grep '^ACTION ' "$REPORT_PATH" | tail -n 5 | head -c 1200)"
  enqueue_notification "🛠️ הבדיקה השבועית של האייג׳נט מצאה פעולה שנדרשת ממך:"$'\n'"$action_lines"
  exit 2
fi

if (( FORCE_SCOPED_REPAIR != 1 )); then
  print -r -- "\n== Deterministic restart attempt ==" >> "$REPORT_PATH"
  restart_agent
  run_checks
  restart_status=$?

  if (( restart_status == 0 )); then
    enqueue_notification '🛠️ הבדיקה השבועית מצאה תקלה באייג׳נט ותיקנה אותה באמצעות build והפעלה מחדש. כל הבדיקות והחיבורים תקינים כעת.'
    exit 0
  fi

  if (( restart_status == 2 )); then
    action_lines="$(grep '^ACTION ' "$REPORT_PATH" | tail -n 5 | head -c 1200)"
    enqueue_notification "🛠️ האייג׳נט הופעל מחדש, אך עדיין נדרשת פעולה ממך:"$'\n'"$action_lines"
    exit 2
  fi
fi

print -r -- "\n== Scoped Codex repair ==" >> "$REPORT_PATH"
codex_summary_path="$(mktemp "$REPORT_DIRECTORY/.codex-summary.XXXXXX")"
"$CODEX_BINARY" exec \
  --ephemeral \
  --cd "$REPOSITORY_ROOT" \
  --sandbox workspace-write \
  --approve-for-me \
  --color never \
  --output-last-message "$codex_summary_path" \
  - < "$PROMPT_PATH" >> "$REPORT_PATH" 2>&1
codex_status=$?
print -r -- "Codex exit status: $codex_status" >> "$REPORT_PATH"
if [[ -s "$codex_summary_path" ]]; then
  print -r -- "\n== Codex summary ==" >> "$REPORT_PATH"
  head -c 4000 "$codex_summary_path" >> "$REPORT_PATH"
  print -r -- '' >> "$REPORT_PATH"
fi
rm -f "$codex_summary_path"

restart_agent
run_checks
final_status=$?

if (( final_status == 0 )); then
  enqueue_notification '🛠️ הבדיקה השבועית מצאה תקלה בפלואו, Codex תיקן אותה, וכל הבדיקות והחיבורים תקינים אחרי ההפעלה מחדש.'
  exit 0
fi

if (( final_status == 2 )); then
  action_lines="$(grep '^ACTION ' "$REPORT_PATH" | tail -n 5 | head -c 1200)"
  enqueue_notification "🛠️ בוצע ניסיון תיקון שבועי, אך נשארה פעולה שנדרשת ממך:"$'\n'"$action_lines"
  exit 2
fi

enqueue_notification "🛠️ הבדיקה השבועית מצאה תקלה שלא ניתן היה לתקן אוטומטית. לא בוצעו פעולות חיצוניות. הדוח נשמר מקומית בשם $RUN_TIMESTAMP.log."
exit 1
