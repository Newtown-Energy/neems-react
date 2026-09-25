import React from 'react';
import { useTheme } from '@mui/material';
import { SLD_FONT } from '../sldTypography';
import type { ProjectInfo } from '../../../designs/types';

/**
 * Fields by column, left to right. The address gets a column to itself
 * because it is the one value long enough to wrap; the shorter pairs stack
 * beside it, which keeps the block wide and short.
 */
function columnsFor(info: ProjectInfo): Array<Array<[string, string]>> {
  return [
    [['Address', info.address]],
    [
      ['COD Date', info.codDate],
      ['BESS Rating', info.bessRating],
    ],
    [
      ['Utility Project Code', info.utilityProjectCode],
      ['Developer Project #', info.developerProjectNumber],
    ],
  ];
}

const PAD = 10;
const TITLE_BASELINE = PAD + SLD_FONT.label;
const FIELDS_TOP = TITLE_BASELINE + 10;
const LINE_HEIGHT = 15;
/** Gap below a field's last value line, before the next field's label. */
const FIELD_GAP = 8;
/** Gutter between columns, so a wrapped value never touches its neighbour. */
const COL_GUTTER = 8;
/** Monospace glyphs are ~0.6em wide, which is what sizes the wrap. */
const CHAR_WIDTH_RATIO = 0.6;

/**
 * Greedy word wrap, so a long value (the address) flows onto a second line
 * inside its column instead of running into the next one.
 */
function wrapValue(value: string, maxChars: number): string[] {
  if (maxChars <= 0) return [value];
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface SiteInfoPanelProps {
  x: number;
  y: number;
  width: number;
  /** The site identity to show; each design supplies its own. */
  info: ProjectInfo;
}

/**
 * Site identity block drawn inside the diagram, so it pans and zooms with the
 * equipment it describes. Sits in the open band beside the utility feed, laid
 * out wide and short, each label above its value.
 */
const SiteInfoPanel: React.FC<SiteInfoPanelProps> = ({ x, y, width, info }) => {
  const theme = useTheme();
  const columnsSpec = columnsFor(info);
  const colWidth = (width - PAD * 2) / columnsSpec.length;
  const maxChars = Math.floor(
    (colWidth - COL_GUTTER) / (SLD_FONT.subtitle * CHAR_WIDTH_RATIO),
  );

  // Lay each column out top-down first, so the panel sizes itself to the
  // tallest column rather than guessing a height the values may not fit in.
  let contentBottom = FIELDS_TOP;
  const columns = columnsSpec.map((fields, col) => {
    let cursor = FIELDS_TOP;
    const cells = fields.map(([label, value]) => {
      const labelBaseline = cursor + SLD_FONT.subtitle;
      const lines = wrapValue(value, maxChars);
      cursor = labelBaseline + LINE_HEIGHT * lines.length + FIELD_GAP;
      return { label, labelBaseline, lines };
    });
    contentBottom = Math.max(contentBottom, cursor - FIELD_GAP);
    return { columnX: PAD + col * colWidth, cells };
  });
  const height = contentBottom + PAD;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={4}
        fill={theme.palette.background.paper}
        stroke={theme.palette.divider}
        strokeWidth={1.5}
      />
      <text
        x={PAD}
        y={TITLE_BASELINE}
        fontSize={SLD_FONT.label}
        fontFamily="monospace"
        fontWeight="bold"
        fill={theme.palette.text.primary}
      >
        {info.name}
      </text>
      {columns.map(({ columnX, cells }) =>
        cells.map(({ label, labelBaseline, lines }) => (
          <React.Fragment key={label}>
            <text
              x={columnX}
              y={labelBaseline}
              fontSize={SLD_FONT.subtitle}
              fontFamily="monospace"
              fontWeight="bold"
              fill={theme.palette.text.secondary}
            >
              {label}
            </text>
            {lines.map((line, i) => (
              <text
                key={line}
                x={columnX}
                y={labelBaseline + LINE_HEIGHT * (i + 1)}
                fontSize={SLD_FONT.subtitle}
                fontFamily="monospace"
                fill={theme.palette.text.primary}
              >
                {line}
              </text>
            ))}
          </React.Fragment>
        )),
      )}
    </g>
  );
};

export default SiteInfoPanel;
