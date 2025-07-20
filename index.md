---
layout: default
title: Posts
---

# Posts

<ul>
{% for file in site.static_files %}
  {% if file.path contains 'posts' and file.extname == '.md' %}
    <li><a href="{{ file.path | relative_url }}">{{ file.name }}</a></li>
  {% endif %}
{% endfor %}
</ul>
