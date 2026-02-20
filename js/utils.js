function getWorldPos(e) {
    return {
        x: e.clientX - viewOffset.x,
        y: e.clientY - viewOffset.y
    };
}

function drawMultilineText(ctx, text, x, y, fontSize, color, bgColor = null, highlight = false) {
    if (!text) return { width: 0, height: 0 };
    const lines = text.split('\n');
    const lineHeight = fontSize + 4;
    const theme = getTheme();

    // First pass: measure text
    let maxWidth = 0;
    const measuredLines = lines.map(line => {
        if (!highlight) {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
            return { tokens: [{ text: line, color: color }], width: w };
        }

        // Tokenize for syntax highlighting
        const regex = /(\[.*?\])|(\b\w+\s*\([^)]*\))/g;
        let tokens = [];
        let lastIndex = 0;
        let match;
        let lineWidth = 0;

        while ((match = regex.exec(line)) !== null) {
            if (match.index > lastIndex) {
                const part = line.substring(lastIndex, match.index);
                tokens.push({ text: part, color: color });
                lineWidth += ctx.measureText(part).width;
            }
            const mText = match[0];
            const mColor = match[1] ? theme.syntaxCondition : theme.syntaxFunction;
            tokens.push({ text: mText, color: mColor });
            lineWidth += ctx.measureText(mText).width;
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < line.length) {
            const part = line.substring(lastIndex);
            tokens.push({ text: part, color: color });
            lineWidth += ctx.measureText(part).width;
        }
        if (lineWidth > maxWidth) maxWidth = lineWidth;
        return { tokens, width: lineWidth };
    });

    const totalHeight = lines.length * lineHeight;

    if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x - maxWidth / 2 - 4, y - totalHeight / 2 - 2, maxWidth + 8, totalHeight + 4);
    }

    // Second pass: draw
    const oldAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    measuredLines.forEach((mLine, i) => {
        const lineY = y - totalHeight / 2 + i * lineHeight + fontSize / 2 + 2;
        let currentX = x - mLine.width / 2;

        mLine.tokens.forEach(token => {
            ctx.fillStyle = token.color;
            ctx.fillText(token.text, currentX, lineY);
            currentX += ctx.measureText(token.text).width;
        });
    });
    ctx.textAlign = oldAlign;

    return { width: maxWidth, height: totalHeight };
}
