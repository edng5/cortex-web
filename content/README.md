# Content — the ontology

Every `.md` file here becomes one neuron on the home page **and** is chunked into
the vector database Cortex searches when answering questions.

| Folder          | Node type     | id prefix (suggested) |
|-----------------|---------------|-----------------------|
| `about/`        | about         | `about-`              |
| `experience/`   | experience    | `exp-`                |
| `education/`    | education     | `edu-`                |
| `projects/`     | project       | `proj-`               |
| `publications/` | publication   | `pub-`                |
| `skills/`       | skill         | `skill-`              |
| `interests/`    | interest      | `int-`                |
| `quotes/`       | quote         | `quote-`              |

Workflow:

1. `npm run new-node -- project proj-my-thing "My Thing"` (or copy a file from `_templates/`).
2. Fill in the frontmatter and write the body in markdown. The more detail in the body,
   the better Cortex can answer.
3. Put images in `static/images/` and reference them as `/images/file.png`.
4. `npm run ingest` — re-embeds everything and recomputes similarity edges.

Edges = `related:` links you declare (always shown) + the top-3 most semantically
similar nodes computed at ingest. Files starting with `_` are ignored.

### In-text carousels
To put a carousel inside a node's description (e.g. team headshots under "Meet the Team"),
list the pictures under a name in the frontmatter and drop a marker in the body where it should go:

```yaml
carousels:
  team:
    - /images/speakease/team/edward.jpg
captions:
  /images/speakease/team/edward.jpg: "Edward"
```

```markdown
## Meet the Team
<!-- carousel: team round -->
```

These pictures appear only in that spot, not with the node's other pictures. Add `round`
after the name (as above) to crop them into circular headshots; leave it off for a normal carousel.

### Section icons
Put an image at the start of a heading to show a small icon beside it:

```markdown
## ![](/images/mini-games/i-spy.jpg) I Spy
```

### Floating vs. carousel
On desktop, a node's pictures float as a draggable pile. Add `mediaLayout: carousel` to a
node's frontmatter to show them in a carousel instead (NEOS does this).
Use `mediaLayout: gallery` to open a large centred photo gallery instead of the info panel
(Photography does this).
