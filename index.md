---
layout: default
title: Posts
---

<ul>
{% for file in site.static_files %}
  {% if file.path contains 'posts' and file.extname == '.md' %}
    {% assign cleanname = file.name | remove: '.md' %}
    <li><a href="{{ file.path | relative_url }}">{{ cleanname }}</a></li>
  {% endif %}
{% endfor %}
</ul>
