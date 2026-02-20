import os

path = r'd:\Documents\ProgramasAG\GraficadorFSM\script.js'

with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Define the old function body we want to replace
old_mouseDown = """    function dragMouseDown(e) {
        // Only trigger if clicking the header itself or its children
        if (e.target !== header && !header.contains(e.target)) return;
        
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
        
        // Bring to front
        const panels = document.querySelectorAll('.panel');
        panels.forEach(p => p.style.zIndex = "100");
        panel.style.zIndex = "1000";
    }"""

# Define the new function body
new_mouseDown = """    function dragMouseDown(e) {
        // Only trigger if clicking the header itself or its children
        if (e.target !== header && !header.contains(e.target)) return;
        
        e.preventDefault();

        // Get current position and stabilize coordinates
        const rect = panel.getBoundingClientRect();
        panel.style.left = rect.left + "px";
        panel.style.top = rect.top + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        panel.style.margin = "0";

        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
        
        // Bring to front
        const panels = document.querySelectorAll('.panel');
        panels.forEach(p => p.style.zIndex = "100");
        panel.style.zIndex = "1000";
    }"""

# We'll try to be more flexible with the replacement if exact match fails
if old_mouseDown in content:
    content = content.replace(old_mouseDown, new_mouseDown)
    with open(path, 'w', encoding='utf-8-sig') as f:
        f.write(content)
    print("Successfully replaced using exact match.")
else:
    # Try alternate: replace by lines or smaller chunks
    print("Exact match failed. Trying line-by-line normalization.")
    # Normalize lines (remove trailing spaces, handle CRLF)
    lines = content.splitlines()
    new_lines = []
    found = False
    i = 0
    while i < len(lines):
        line = lines[i]
        if 'function dragMouseDown(e) {' in line and 'if (e.target !== header' in lines[i+2]:
            found = True
            new_lines.append(line) # function dragMouseDown(e) {
            new_lines.append(lines[i+1]) # if (e.target !== header
            new_lines.append(lines[i+2]) # if (e.target !== header (wait, adjustment)
            # Actually, let's just insert the new logic after e.preventDefault();
            # We'll skip down to e.preventDefault
        new_lines.append(line)
        i += 1
    
    # Let's try a simpler regex-like replacement in python
    import re
    # Match the function start and its first few lines
    pattern = r'(\s+function dragMouseDown\(e\) \{[\s\S]+?e\.preventDefault\(\);)'
    replacement = r'\1\n\n        // Get current position and stabilize coordinates\n        const rect = panel.getBoundingClientRect();\n        panel.style.left = rect.left + "px";\n        panel.style.top = rect.top + "px";\n        panel.style.right = "auto";\n        panel.style.bottom = "auto";\n        panel.style.margin = "0";'
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        with open(path, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print("Successfully replaced using regex.")
    else:
        print("Regex match also failed.")
