# Posts

{% raw %}
{% for file in site.static_files %}
{% if file.path contains 'posts' and file.extname == '.md' %}
- [{{ file.name }}]({{ file.path | relative_url }})
{% endif %}
{% endfor %}
{% endraw %}
