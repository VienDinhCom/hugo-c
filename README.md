

## Rules

* Do not code **HTML**, SCSS, JS in the **global**, **shortcodes**, **[type]/[layout]** folders.
* For **shortcodes** and **[content type]/[layout.html]**, you must include partials to render the template in HTML.

### Global Rules
* The `src/layouts/global/global.scss` file is only for:
  * Defining global SCSS variables for the partials.
  * Importing functions, mixins and variables from `src/layouts/vendor/[library]` folder.
  * Writing global code for all partials and pages. However, be careful!

* The `src/layouts/global/global.js` file is only for:
  * Defining global JavaScript constants, variables for the partials.
  * Writing global code for all partials and pages. However, be careful!

### Partial Rules
Only code HTML, SCSS, JS in the `src/layouts/partials/app-[partial name]` folders.

* For `app-[partial name].html`, the HTML files should have comments likes this.
```
<section class="app-post-single">
    {{- .Content -}}
</section>
<!-- /.app-post-single -->
```

* For `app-[partial name].scss`

* For `app-[partial name].js`
