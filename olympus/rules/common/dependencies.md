# Dependencies

## Judge by provenance, not by the README

A README describes what a package intends to do. It tells you nothing about whether the code
is maintained, whether the author is accountable, or what it does on your machine. Before
adding anything, check:

| Signal | What to look for |
|---|---|
| Who maintains it | A known organisation, or one anonymous account? |
| How long it has existed | Weeks, or years with a release history? |
| Traction relative to claims | A tool claiming to be widely used should have issues, forks, and contributors in proportion |
| Last meaningful commit | Not a version bump, an actual fix |
| Licence | Present, and compatible with what you intend to do |

> Scar: a document-conversion GUI with one star, one author, and three months of existence
> would have processed personal documents. The upstream tool it wraps is maintained
> by Microsoft. Use the upstream.

## Star counts are weak evidence

A very high star count with a disproportionately low issue count is a mismatch worth noticing,
not proof of fraud but a reason to stop treating popularity as vetting. Judge on what the code
actually does.

## Prefer what already ships

Before adding a dependency, check whether the language, the framework, or the standard library
already does it. A date picker exists in the browser. Most string manipulation exists in the
standard library.

The cost of a dependency is not the install: it is the upgrade you will be forced into, the
transitive packages you did not choose, and the day it is abandoned.

## Pin what you depend on

A financial or long-lived project pins exact versions, so it still installs and behaves the
same in five years. Keep the short hand-written list separate from the generated pinned one:
edit the first, regenerate the second.

Unpinned, a parsing library changes behaviour in a minor release and a scraper breaks silently,
which is the worst failure mode because nothing announces it.

## Weigh what a dependency costs at runtime, not just at install

An eighth package pulled in to render one static image, or a heavy chain dragged in for a
single field, is usually the wrong trade in a small project. Ask what it replaces and what it
would take to do without it.

> Scar: a proposal added matplotlib, tens of megabytes, to render a chart in a project whose
> UI already drew SVG inline with zero dependencies.

## Anything that executes is a trust decision

Hooks, plugins, MCP servers, and agent definitions from outside are code running with your
permissions. The bar is higher than for a library you call, because you invoke a library
deliberately and these run on their own schedule.

Read what you install, prefer narrow read-only tools over frameworks, and test on a project
where nothing is at stake before pointing it at real data.
