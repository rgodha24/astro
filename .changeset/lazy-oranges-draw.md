---
'astro': major
---

Updates where files are generated by `astro sync`.

To avoid collisions with files generated by integrations, any file generated by Astro in `/.astro/` is now moved to `/.astro/astro/`. It should only break usage of JSON Schemas for legacy data collections:

```diff
{
-  "$schema": "../../../.astro/collections/authors.schema.json",
+  "$schema": "../../../.astro/astro/collections/authors.schema.json",
  "name": "Armand",
  "skills": ["Astro", "Starlight"]
}
```