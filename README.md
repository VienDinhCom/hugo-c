# Partial-based (Component-based) Workspace for Hugo CMS Development

## Rules

* Do not code **HTML**, SCSS, JS in the **global**, **shortcodes**, **[type]/[layout]** folders.
* For **shortcodes** and **[content type]/[layout.html]**, you must include partials to render the template in HTML.

### Global Rules
**1.** The `src/layouts/global/global.scss` file is only for:
  * Defining global SCSS variables for the partials.
  * Importing functions, mixins and variables from `src/layouts/vendor/[library]` folder.
  * Writing global code for all partials and pages. However, be careful!

**2.** The `src/layouts/global/global.js` file is only for:
  * Defining global JavaScript constants, variables for the partials.
  * Writing global code for all partials and pages. However, be careful!

### Partial Rules
Only code HTML, SCSS, JS in the `src/layouts/partials/app-[partial name]` folders.

**1.** For `app-[partial name].html`, the HTML files should have comments likes this.
```
<section class="app-post-single">
  {{- .Content -}}
</section>
<!-- /.app-post-single -->
```
You can use this Emmet shortcut `section.app-post-single|c` and press `tab` to create the comments more quickly.

**2.** For `app-[partial name].scss`, your code must be in `:host { ... }` to avoid the CSS conflicts.
```
:host {
  color: black;
  background: white;
}
// Do not write your code out here.
```

**3.** For `app-[partial name].js`, you will use `$(this)` to select the current partial in DOM.
```
$(this).css('color', 'blue');
```
```
const partial = this;

$(partial).find('button').click(function() {
  $(partial).css('color', 'blue');
});
```
