function getWorldPos(e) {
    return {
        x: e.clientX - viewOffset.x,
        y: e.clientY - viewOffset.y
    };
}

function drawMultilineText(ctx, text, x, y, fontSize, color, bgColor = null, highlight = false, isFailing = false) {
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
                tokens.push({ text: part, color: color, isCondition: false });
                lineWidth += ctx.measureText(part).width;
            }
            const mText = match[0];
            const isCondToken = !!match[1];
            const mColor = (isFailing && isCondToken) ? '#ff4d4d' : (match[1] ? theme.syntaxCondition : theme.syntaxFunction);

            if (isFailing && isCondToken) ctx.font = `bold ${fontSize + 2}px Arial`;
            else ctx.font = `${fontSize}px Arial`;

            tokens.push({ text: mText, color: mColor, isCondition: isCondToken });
            lineWidth += ctx.measureText(mText).width;
            lastIndex = regex.lastIndex;
            ctx.font = `${fontSize}px Arial`;
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
            let drawX = currentX;
            let drawY = lineY;

            if (isFailing && token.isCondition) {
                ctx.font = `bold ${fontSize + 2}px Arial`;
                drawX += (Math.random() - 0.5) * 6;
                drawY += (Math.random() - 0.5) * 6;
            } else {
                ctx.font = `${fontSize}px Arial`;
            }

            ctx.fillText(token.text, drawX, drawY);
            currentX += ctx.measureText(token.text).width;
            ctx.font = `${fontSize}px Arial`;
        });
    });
    ctx.textAlign = oldAlign;

    return { width: maxWidth, height: totalHeight };
}

class State {
    constructor(x, y, id, isPseudo = false) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.label = isPseudo ? "" : `q${id}`;
        this.action = "";
        this.radius = isPseudo ? 18 : STATE_RADIUS;
        this.isStart = false;
        this.isPseudostate = isPseudo;
        this.simWarning = null;
    }

    draw(ctx) {
        const theme = getTheme();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        if (activeState === this) {
            ctx.fillStyle = theme.activeState;
        } else {
            ctx.fillStyle = this.isPseudostate ? theme.stateStroke : theme.stateFill;
        }

        ctx.fill();
        ctx.strokeStyle = theme.stateStroke;
        ctx.lineWidth = this.isPseudostate ? 1 : 2;
        ctx.stroke();

        if (this.isPseudostate) {
            if (this.simWarning) {
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '20px Arial';
                ctx.fillText('⚠️', this.x, this.y);
                ctx.restore();
            }
            return;
        }

        if (this.isStart) {
            const dotX = this.x - this.radius - 35;
            const dotY = this.y;
            const arrowEndX = this.x - this.radius;

            // Draw start dot
            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fillStyle = theme.transition;
            ctx.fill();

            // Draw line to state
            ctx.beginPath();
            ctx.moveTo(dotX, dotY);
            ctx.lineTo(arrowEndX, dotY);
            ctx.strokeStyle = theme.transition;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw arrowhead correctly at the edge
            ctx.beginPath();
            ctx.moveTo(arrowEndX, dotY);
            ctx.lineTo(arrowEndX - 8, dotY - 5);
            ctx.lineTo(arrowEndX - 8, dotY + 5);
            ctx.closePath();
            ctx.fillStyle = theme.transition;
            ctx.fill();
        }

        if (selectedObject === this) {
            ctx.save();
            ctx.strokeStyle = theme.selected;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = theme.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 5, 0, Math.PI * 2);
        ctx.clip();

        if (this.action) {
            ctx.fillStyle = theme.text;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.label, this.x, this.y - 15);

            ctx.beginPath();
            ctx.moveTo(this.x - this.radius * 0.6, this.y - 2);
            ctx.lineTo(this.x + this.radius * 0.6, this.y - 2);
            ctx.strokeStyle = theme.stateStroke;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            ctx.font = '12px Arial';
            drawMultilineText(ctx, this.action, this.x, this.y + 18, 12, theme.text, null, true);
        } else {
            ctx.fillStyle = theme.text;
            ctx.font = '22px Arial';
            ctx.fillText(this.label, this.x, this.y);
        }
        ctx.restore();
    }

    isHit(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const hitMargin = this.isPseudostate ? 5 : 0;
        const totalRadius = this.radius + hitMargin;
        return dx * dx + dy * dy < totalRadius * totalRadius;
    }
}

class Transition {
    constructor(from, to) {
        this.from = from;
        this.to = to;
        this.label = "";
        this.action = "";
        this.controlOffset = { x: 0, y: 0 };
        this.startAnchorAngle = null;
        this.endAnchorAngle = null;
        this.labelOffset = { x: 0, y: 0 };
        this.failHighlightUntil = 0;
    }

    draw(ctx) {
        const theme = getTheme();
        if (selectedObject === this) {
            ctx.strokeStyle = theme.selected;
            ctx.lineWidth = 4;
        } else {
            ctx.strokeStyle = theme.transition;
            ctx.lineWidth = 2;
        }
        ctx.beginPath();

        let startX, startY, endX, endY, cpX, cpY, cp2X, cp2Y;
        let isLoop = (this.from === this.to);

        const angleFrom = this.startAnchorAngle !== null
            ? this.startAnchorAngle
            : Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x);

        const angleTo = this.endAnchorAngle !== null
            ? this.endAnchorAngle
            : Math.atan2(this.from.y - this.to.y, this.from.x - this.to.x);

        if (isLoop) {
            const r = this.from.radius;
            const startA = this.startAnchorAngle !== null ? this.startAnchorAngle : -Math.PI / 2 - 0.4;
            const endA = this.endAnchorAngle !== null ? this.endAnchorAngle : -Math.PI / 2 + 0.4;

            startX = this.from.x + Math.cos(startA) * r;
            startY = this.from.y + Math.sin(startA) * r;
            endX = this.from.x + Math.cos(endA) * r;
            endY = this.from.y + Math.sin(endA) * r;

            let pushMag = r * 1.8;
            if (this.controlOffset.x !== 0 || this.controlOffset.y !== 0) {
                pushMag = Math.sqrt(this.controlOffset.x ** 2 + this.controlOffset.y ** 2) + r + 15;
            }

            cpX = startX + Math.cos(startA) * pushMag + this.controlOffset.x;
            cpY = startY + Math.sin(startA) * pushMag + this.controlOffset.y;
            cp2X = endX + Math.cos(endA) * pushMag + this.controlOffset.x;
            cp2Y = endY + Math.sin(endA) * pushMag + this.controlOffset.y;

        } else {
            startX = this.from.x + Math.cos(angleFrom) * this.from.radius;
            startY = this.from.y + Math.sin(angleFrom) * this.from.radius;
            endX = this.to.x + Math.cos(angleTo) * this.to.radius;
            endY = this.to.y + Math.sin(angleTo) * this.to.radius;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            cpX = midX + this.controlOffset.x;
            cpY = midY + this.controlOffset.y;
        }

        ctx.moveTo(startX, startY);
        if (isLoop) {
            ctx.bezierCurveTo(cpX, cpY, cp2X, cp2Y, endX, endY);
        } else {
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        ctx.stroke();

        const tipCPX = isLoop ? cp2X : cpX;
        const tipCPY = isLoop ? cp2Y : cpY;
        const angleToEnd = Math.atan2(endY - tipCPY, endX - tipCPX);
        this.drawArrow(ctx, endX, endY, angleToEnd);

        let curveMidX, curveMidY;
        if (isLoop) {
            curveMidX = 0.125 * startX + 0.375 * cpX + 0.375 * cp2X + 0.125 * endX;
            curveMidY = 0.125 * startY + 0.375 * cpY + 0.375 * cp2Y + 0.125 * endY;
        } else {
            curveMidX = 0.25 * startX + 0.5 * cpX + 0.25 * endX;
            curveMidY = 0.25 * startY + 0.5 * cpY + 0.25 * endY;
        }

        const labelDist = 20; // Default perpendicular distance
        let labelX, labelY;

        if (isLoop) {
            // For loops, offset outwards from the state center
            const angleMid = Math.atan2(curveMidY - this.from.y, curveMidX - this.from.x);
            labelX = curveMidX + Math.cos(angleMid) * labelDist + this.labelOffset.x;
            labelY = curveMidY + Math.sin(angleMid) * labelDist + this.labelOffset.y;
        } else {
            // For curves, calculate normal to the straight path
            const dx = endX - startX;
            const dy = endY - startY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            // Normal vector (-dy, dx)
            const nx = -dy / len;
            const ny = dx / len;

            labelX = curveMidX + nx * labelDist + this.labelOffset.x;
            labelY = curveMidY + ny * labelDist + this.labelOffset.y;
        }
        let textWidth = 0;
        let textHeight = 0;

        if (this.label || this.action) {
            let fullText = "";
            if (this.from.isPseudostate) {
                let condText = this.label.trim();
                if (condText && !condText.startsWith('[')) condText = `[${condText}]`;
                fullText = condText;
                if (this.action) {
                    fullText = fullText ? fullText + " / " + this.action : "/ " + this.action;
                }
            } else {
                fullText = this.label;
                if (this.action) {
                    fullText = fullText ? fullText + " / " + this.action : "/ " + this.action;
                }
            }

            if (fullText) {
                const isFailing = Date.now() < this.failHighlightUntil;
                const dims = drawMultilineText(ctx, fullText, labelX, labelY, 14, theme.labelColor, theme.labelBg, true, isFailing);
                textWidth = dims.width;
                textHeight = dims.height;
            }
        }

        const handleColor = theme.handle;
        this.drawHandle(ctx, curveMidX, curveMidY, handleColor);
        this.drawHandle(ctx, startX, startY, handleColor);
        this.drawHandle(ctx, endX, endY, handleColor);

        this.computed = {
            startX, startY, endX, endY,
            cpX: curveMidX,
            cpY: curveMidY,
            rawCpX: isLoop ? (cpX + cp2X) / 2 : cpX,
            rawCpY: isLoop ? (cpY + cp2Y) / 2 : cpY,
            labelX, labelY, textWidth, textHeight
        };
    }

    drawArrow(ctx, x, y, angle) {
        const size = 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size / 2);
        ctx.lineTo(-size, size / 2);
        ctx.closePath();
        const theme = getTheme();
        ctx.fillStyle = theme.transition;
        if (selectedObject === this) ctx.fillStyle = theme.selected;
        ctx.fill();
        ctx.restore();
    }

    drawHandle(ctx, x, y, color) {
        if (handleOpacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = handleOpacity;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    getHitPart(x, y) {
        if (!this.computed) return null;
        const dist = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;
        const R2 = 100;

        if (dist(x, y, this.computed.cpX, this.computed.cpY) < R2) return 'control';
        if (dist(x, y, this.computed.startX, this.computed.startY) < R2) return 'start';
        if (dist(x, y, this.computed.endX, this.computed.endY) < R2) return 'end';

        if (this.label || this.action) {
            const lx = this.computed.labelX;
            const ly = this.computed.labelY;
            const tw = this.computed.textWidth / 2 + 5;
            const th = this.computed.textHeight / 2 + 5;
            if (x > lx - tw && x < lx + tw && y > ly - th && y < ly + th) {
                return 'label';
            }
        }
        return null;
    }

    isHit(x, y) {
        return this.getHitPart(x, y) !== null;
    }
}

class TransitionAnimation {
    constructor(transition) {
        this.transition = transition;
        this.startTime = Date.now();
        this.complete = false;
        const dist = (x1, y1, x2, y2) => Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
        const SPEED = 2.5;
        let pathLength = 0;

        if (transition.isStartAnimation) {
            this.isStartAnimation = true;
            this.startX = transition.fromX;
            this.startY = transition.fromY;
            this.endX = transition.toX;
            this.endY = transition.toY;
            pathLength = dist(this.startX, this.startY, this.endX, this.endY);
            this.duration = Math.max(100, pathLength / SPEED);
            return;
        }

        this.path = { ...transition.computed };
        this.isLoop = (transition.from === transition.to);

        if (this.isLoop) {
            const r = transition.from.radius;
            const startA = transition.startAnchorAngle !== null ? transition.startAnchorAngle : -Math.PI / 2 - 0.4;
            const endA = transition.endAnchorAngle !== null ? transition.endAnchorAngle : -Math.PI / 2 + 0.4;
            let pushMag = r * 1.8;
            if (transition.controlOffset.x !== 0 || transition.controlOffset.y !== 0) {
                pushMag = Math.sqrt(transition.controlOffset.x ** 2 + transition.controlOffset.y ** 2) + r + 15;
            }
            this.cp1X = this.path.startX + Math.cos(startA) * pushMag + transition.controlOffset.x;
            this.cp1Y = this.path.startY + Math.sin(startA) * pushMag + transition.controlOffset.y;
            this.cp2X = this.path.endX + Math.cos(endA) * pushMag + transition.controlOffset.x;
            this.cp2Y = this.path.endY + Math.sin(endA) * pushMag + transition.controlOffset.y;

            pathLength = dist(this.path.startX, this.path.startY, this.cp1X, this.cp1Y) +
                dist(this.cp1X, this.cp1Y, this.cp2X, this.cp2Y) +
                dist(this.cp2X, this.cp2Y, this.path.endX, this.path.endY);
        } else {
            pathLength = dist(this.path.startX, this.path.startY, this.path.cpX, this.path.cpY) +
                dist(this.path.cpX, this.path.cpY, this.path.endX, this.path.endY);
        }

        this.duration = Math.max(100, pathLength / SPEED);
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        this.t = Math.min(1, elapsed / this.duration);
        if (this.t >= 1) this.complete = true;
    }

    getPos(t) {
        if (this.isStartAnimation) {
            return {
                x: this.startX + (this.endX - this.startX) * t,
                y: this.startY + (this.endY - this.startY) * t
            };
        }
        let x, y;
        const invT = (1 - t);
        if (this.isLoop) {
            x = invT ** 3 * this.path.startX + 3 * invT ** 2 * t * this.cp1X + 3 * invT * t ** 2 * this.cp2X + t ** 3 * this.path.endX;
            y = invT ** 3 * this.path.startY + 3 * invT ** 2 * t * this.cp1Y + 3 * invT * t ** 2 * this.cp2Y + t ** 3 * this.path.endY;
        } else {
            x = invT ** 2 * this.path.startX + 2 * invT * t * this.path.rawCpX + t ** 2 * this.path.endX;
            y = invT ** 2 * this.path.startY + 2 * invT * t * this.path.rawCpY + t ** 2 * this.path.endY;
        }
        return { x, y };
    }

    draw(ctx) {
        const theme = getTheme();
        for (let i = 4; i >= 0; i--) {
            const trailT = this.t - (i * 0.04);
            if (trailT < 0 || trailT > 1) continue;
            const pos = this.getPos(trailT);
            const size = (i === 0) ? 12 : 10 - i * 1.5;
            const alpha = 1 - (i * 0.2);
            ctx.save();
            ctx.globalAlpha = alpha;
            if (i === 0) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = theme.transition;
            }
            const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.4, theme.transition);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}
