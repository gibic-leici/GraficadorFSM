class State {
    constructor(x, y, id, isPseudo = false) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.label = isPseudo ? "" : `q${id}`;
        this.action = "";
        this.radius = isPseudo ? 18 : STATE_RADIUS; // Larger dots for easier grabbing
        this.isStart = false;
        this.isPseudostate = isPseudo;
        this.simWarning = null; // "deadlock" or "conflict" or null
    }

    draw(ctx) {
        const theme = getTheme();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        if (activeState === this) {
            ctx.fillStyle = theme.activeState;
        } else if (this.isStart) {
            ctx.fillStyle = theme.startState;
        } else {
            ctx.fillStyle = this.isPseudostate ? theme.stateStroke : theme.stateFill;
        }

        ctx.fill();
        ctx.strokeStyle = theme.stateStroke;
        ctx.lineWidth = this.isPseudostate ? 1 : 2;
        ctx.stroke();

        if (this.isPseudostate) {
            if (this.simWarning) {
                const msg = this.simWarning === "deadlock"
                    ? "Bloqueo: Ninguna condición se cumple"
                    : "Conflicto: Múltiples salidas válidas";

                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = '20px Arial';
                ctx.fillText('⚠️', this.x, this.y - 12);
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = theme.name === 'dark' ? '#ff6b6b' : '#c92a2a';
                ctx.fillText(msg, this.x, this.y - 32);
                ctx.restore();
            }
            return;
        }

        if (this.isStart) {
            ctx.beginPath();
            ctx.moveTo(this.x - this.radius - 20, this.y);
            ctx.lineTo(this.x - this.radius, this.y);
            ctx.lineTo(this.x - this.radius - 5, this.y - 5);
            ctx.moveTo(this.x - this.radius, this.y);
            ctx.lineTo(this.x - this.radius - 5, this.y + 5);
            ctx.strokeStyle = theme.transition;
            ctx.stroke();
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

        const labelX = curveMidX + this.labelOffset.x;
        const labelY = curveMidY + this.labelOffset.y;
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
                ctx.font = '14px Arial';
                const dims = drawMultilineText(ctx, fullText, labelX, labelY, 14, theme.labelColor, theme.labelBg, true);
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
