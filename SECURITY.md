# Security

Olympus is mostly text: instructions that Claude Code reads. But a small part of it is code that
runs on your computer, as you, without being asked each time. This page says what that code does,
what Olympus does not protect you from, and how to report a problem privately.

## What runs on my computer?

**The three hooks.** A hook is a small script Claude Code runs by itself at a set moment. Olympus
registers three, in `olympus/hooks/hooks.json`, and each is a Python file you can read in a few
minutes.

| Hook | When it runs | What it reads | What it runs |
|---|---|---|---|
| `handover_pickup.py` | When a chat starts | Whether a `HANDOVER.md` under a week old sits in the folder the chat opened in | Nothing |
| `context_budget.py` | On every message you send | The chat's own transcript, for how full its working memory is, and the optional settings file `~/.claude/context-budget.json` | `git status`, to say whether now is a safe moment to stop |
| `done_gate.py` | When a reply ends | The evidence file a review writes in the chat's temporary folder | `git status`, to see which code files changed |

None of them writes a file, deletes anything or connects to the internet. Two only print a few
lines back to Claude Code. The third, the done gate, can also hold a reply back once: if a code file
changed and no review covered it, it sends Claude back with one line asking for a review or a
reason, and lets the next attempt end whatever happens. Each is built to **fail open**: if it breaks, it exits quietly, so a
broken hook can never stop your chat. The cost of that choice is that a broken hook does not tell
you it stopped working.

`hooks/statusline.py` is a fourth script, for the status line under the chat box. It runs only if
you switch it on yourself in `~/.claude/settings.json`, and it runs `git branch --show-current`.

## What do the third-party commands do?

Nine of the commands were written by other people, listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Three of them run programs, and those three
contact the internet. Olympus's own files make no network calls; these do. The table lists every
contact found by reading their code on 10 October 2026. It is not a guarantee: these commands are
updated by their authors, and Olympus does not check them again.

| Command | What it contacts, and when | How to switch it off |
|---|---|---|
| `impeccable` | Checks `impeccable.style` for a newer version, at most once a day. Its step that deals design options fetches them from `impeccable.style` and, by default, sends back an anonymous ping recording which kind of option won. Its image step sends your prompt to OpenAI, but only when `OPENAI_API_KEY` is set. The page that shows design options loads fonts from Google Fonts and pictures from `impeccable.style` when your browser opens it. Its live mode's "Apply copy edits" hands the edits and your project folder to your open chat if one is listening; otherwise it starts Codex if Codex is installed, and Claude Code if not. Either one is started with its permission checks switched off, so it edits files in that folder without asking. Its instructions let Claude run `npx impeccable` with any arguments without asking you; `npx` downloads the newest published `impeccable` package from npm, the public library of JavaScript packages, and runs it. `impeccable detect <address>` opens the web page you name in a hidden browser, if the Puppeteer package is installed | Set `IMPECCABLE_NO_UPDATE_CHECK=1` for the version check, and `DO_NOT_TRACK=1` or `IMPECCABLE_NO_TELEMETRY=1` for the ping. Leave `OPENAI_API_KEY` unset. The fonts and pictures have no switch: do not open that page. Set `IMPECCABLE_LIVE_COPY_AGENT=claude` to keep live mode off Codex, or `off` to stop it starting any program. Delete the `allowed-tools` lines at the top of `skills/impeccable/SKILL.md` to be asked before each `npx` run |
| `archify` | Checks its author's site, `tt-a1i.github.io`, for a newer version when it finishes a diagram. `archify brands capture <address>` fetches the page you name, following up to three redirects, then the icons that page declares and its `/favicon.ico`, which may be on other sites, to take a logo from it | Set `ARCHIFY_UPDATE_CHECK_DISABLED=1`. The capture has no switch: Claude runs it when you give it a website, and nothing stops it running otherwise |
| `graphify` | The first time it runs, installs its own Python package, `graphifyy`, from PyPI, the public library of Python packages, without asking first; if the ordinary install fails, it installs into your system's Python with `--break-system-packages`. Downloads a GitHub repository if you give it one. Sends file contents to Google's Gemini when `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set. Its standalone command `graphify extract` sends the contents of documents, papers and images (code alone stays on your computer), and `graphify label` and `graphify cluster-only` send the graph's labels, to whichever AI service has a key or setting present, in this order: Gemini, Moonshot, Anthropic, OpenAI, DeepSeek, Azure, Amazon Bedrock (chosen when `AWS_REGION`, `AWS_PROFILE` or `AWS_DEFAULT_REGION` is set, as one often is) and Ollama; or to a service you defined in `~/.graphify/providers.json` when its key is set, or to the `claude` command when you name it. With `--google-workspace` or `GRAPHIFY_GOOGLE_WORKSPACE=1`, it reads Google Drive files through Google's `gws` command. Its own instructions say it reads no key but Gemini's; that is true of the steps Claude follows, not of these commands. The graph pages it writes load code from `unpkg.com`, `cdn.jsdelivr.net` and `d3js.org` when you open them. `graphify add <address>` fetches the page you name, and may call Twitter's and arXiv's sites or download a video's audio | Install `graphifyy` yourself beforehand if you want to read it first. Leave those keys unset. Do not run the standalone commands with AI keys or AWS settings present. Open the graph pages offline if you want no contact |

`graphify` runs only when you type it. Your chat can start `impeccable` and `archify` by itself
when a request fits, and the design reviewer reads `impeccable`'s design criteria, though it cannot
run its scripts.

Beyond the network: `impeccable` and `archify` run Node.js scripts, and `archify` opens a hidden
browser to check the diagrams it draws. Both can start a small preview server that only this
computer can reach. And `/impeccable hooks on` installs a hook of `impeccable`'s own, which runs
on every file edit in that project until you turn it off. `graphify install` writes into your AI
assistant's settings, and `graphify hook install` adds git hooks that rebuild the graph after each
commit and branch switch.

## What does Olympus not protect against?

Stated plainly, so nobody relies on something that was never promised.

| Not protected | Why |
|---|---|
| **The specialists reading files outside your project** | They can read any file you can. Pointing a review at one folder is an instruction, not a boundary. Keep secrets out of files Claude can reach, as you would without Olympus |
| **What you send to the model** | Everything a specialist reads goes to the model provider, exactly as it would in an ordinary Claude Code chat. Olympus's own files add no network calls, and no protection either; the third-party commands' calls are listed above |
| **Instructions hidden in the code being reviewed** | A file under review can contain text written to steer the reviewer. The specialists cannot act on it, because they hold no tool that edits or runs anything. But a specialist can ask your chat to run a command, under the heading `NEEDS_RUN`, and your chat holds the command line. Read a requested command before you let it run |
| **The research helper used by `/plan-product` and the explore workflow** | Both use Claude Code's built-in `Explore` helper, which holds a command line. "It only reads" is a rule in its instructions, not a limit on its tools |
| **A `CLEAN` review being right** | A review is a second opinion. It can miss real problems, and the measured results in the [README](README.md#what-has-been-measured-and-what-has-not) show it has |
| **Changes you make to your copy** | Editing a specialist's `tools:` line, a hook, or `ZEUS.md` changes what runs. The checks above describe the files as published |

## What counts as a security problem here?

Report these privately, not in a public issue:

| Report privately | Why it matters |
|---|---|
| A specialist that can edit a file or run a command | The read-only reviewer is the design's central promise |
| A hook that writes a file, deletes anything, connects to the internet, or holds a reply back more than once in a row | The hooks run on every message, without asking |
| A review that reports `CLEAN` or `ADVISORY` when one of its reviewers never ran | Reviews are meant to fail closed: an unearned approval is worse than none |
| A workflow that starts without being asked | Workflows are expensive and act at scale |
| Anything in this repository that identifies a real person's private information, a password, or a key | |

Bugs that are not security problems, such as a command not being recognised, a wrong answer from
a reviewer, or an install step that fails, belong in a normal public issue.

## How do I report privately?

**Use GitHub's private vulnerability reporting.** Go to this repository's **Security** tab and
choose **Report a vulnerability**. That opens a private thread visible only to the maintainer. It
needs no email address from you.

If that is unavailable to you, open a public issue containing **only** the sentence "I would like
to report a security issue privately", and wait to be contacted. Do not put the details in it.

Please include what you found in one sentence, how to reproduce it, what you saw, and which copy
you have: there are no version numbers, so give the commit, the output of `git log -1` in your
copy. Do not include real code or files from your own projects; reproduce the problem with invented
content of the same shape.

## What happens next?

This is a small project maintained by one person in their own time, so please expect days rather
than hours: an acknowledgement within about a week, then an assessment and either a fix or an
explanation. **Please allow 90 days before disclosing publicly**, or less if we agree on less. If
there is no response at all within 30 days, treat the project as unmaintained and disclose as you
see fit.

Only the current `main` branch is supported. There are no release branches and no backports.
