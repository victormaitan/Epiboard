window.d3 = require('d3');
/* global d3 */
/* eslint-disable import/first */
import { timelineAxisLeft, timelineAxisRight } from './timelineaxis';
import Tooltip from './tooltip';
import { durationFormat, f } from './utils';

function getFontSize(element) {
  return parseFloat(window.getComputedStyle(element, null).getPropertyValue('font-size'));
}

function lumaBT709(c) {
  return ((c.r * 0.299) + (c.g * 0.587) + (c.b * 0.114));
}

function isBright(color) {
  return lumaBT709(color) > 165;
}

function textColor(value) {
  return isBright(d3.color(value)) ? 'black' : 'white';
}

function translate(x, y) {
  return `translate(${x},${y})`;
}

export default function () {
  let colors = [
    '#4285f4', '#db4437', '#f4b400', '#0f9d58', '#ab47bc', '#5e97f5', '#e06055',
    '#f5bf26', '#33ab71', '#b762c6', '#00acc1', '#ff855f', '#9e9d24', '#26b8ca', '#ff7043',
  ];
  let padding = 5;
  let reversed = false;
  let today = false;
  let dates;
  let constWidth;
  let duration = 0;
  const labels = f(0);
  const names = f(1);
  const starts = f(2);
  const ends = f(3);

  function trimText(d) {
    const task = d3.select(this.parentNode);
    const text = task.select('text');
    const rect = task.select('rect');
    const string = names(d);
    const textWidth = text.node().getComputedTextLength();

    // this is overkill if duration is 0
    d3.active(this)
      .tween('text', () => function tweenText() {
        const width = rect.attr('width') - (2 * padding);
        const ratio = width / textWidth;
        text.text(ratio < 1 ? string.substring(0, Math.floor(string.length * ratio)) : string);
      });
  }

  function tooltipHtml(d) {
    // Format date for human
    const seconds = (ends(d) - starts(d)) / 1000;
    let dateFormat;
    if (seconds < 3600 * 18) {
      dateFormat = '%H:%M:%S';
    } else if (seconds < 86400 * 7) {
      dateFormat = '%m-%d %H:%M';
    } else {
      dateFormat = '%Y-%m-%d';
    }
    const format = x => d3.timeFormat(dateFormat)(d3.isoParse(x));
    return `<b>${names(d)}</b><hr style="margin: 2px 0 2px 0">${format(starts(d))} - ${format(ends(d))}<br>${durationFormat(seconds)}`;
  }

  function chart(selection) {
    const dataTable = selection.datum();
    const rows = d3.map(dataTable, labels).keys();
    const tip = new Tooltip(tooltipHtml);
    const cScale = d3.scaleOrdinal(colors);

    dates = dates || [d3.min(dataTable, starts), d3.max(dataTable, ends)];

    selection.each(function selectionEach(data) {
      const width = constWidth || this.getBoundingClientRect().width;
      const height = rows.length * (getFontSize(this) + (4 * padding));
      const yScale = d3.scaleBand().domain(rows).range([0, height]); // .padding(0.1);
      const xScale = d3.scaleTime().domain(dates);
      const yAxis = (reversed ? timelineAxisRight : timelineAxisLeft)(yScale).width(width);
      const node = d3.select(this);
      node.style('position', 'relative');
      node.select('div').remove();
      node.select('svg').remove();
      const svg = node.append('svg').attr('class', 'timeline');

      svg.attr('width', width);
      svg.attr('height', height + 20); // margin.bottom

      const g = svg.append('g');

      const yGroup = g.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

      const range = yAxis.range();
      xScale.range([range[0] + padding, range[1] - padding]).clamp(true);
      const xAxis = d3.axisBottom(xScale);
      const xGroup = g.append('g')
        .attr('class', 'x axis')
        .attr('transform', translate(0, height))
        .call(xAxis);

      xGroup.select('.domain').remove();
      xGroup.selectAll('.tick line').attr('stroke', '#AAA');

      const ticks = xScale.ticks().map(xScale);
      yGroup.call(yAxis.drawTicks, ticks);

      let tasks = g.selectAll('g.task').data(data);

      tasks.exit().remove();

      const tasksEnter = tasks.enter()
        .append('g')
        .classed('task', true);

      tasksEnter
        .append('rect')
        .attr('y', padding)
        .attr('height', yScale.bandwidth() - (2 * padding))
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide)
        .style('fill', d => cScale(d));

      tasksEnter
        .append('text')
        .attr('text-anchor', 'start')
        .attr('fill', d => textColor(cScale(names(d))))
        .attr('pointer-events', 'none')
        .attr('dx', padding)
        .attr('y', yScale.bandwidth() / 2)
        .attr('dy', '0.32em')
        .text(names);

      tasks = tasks.merge(tasksEnter);

      tasks
        .attr('transform', d => translate(range[0], yScale(labels(d))))
        .selectAll('rect')
        .attr('width', 0);

      tasks
        .transition().duration(duration)
        .attr('transform', d => translate(xScale(starts(d)), yScale(labels(d))))
        .selectAll('rect')
        .attr('width', d => xScale(ends(d)) - xScale(starts(d)))
        .on('start', trimText);

      if (today) {
        svg.append('path')
          .attr('stroke', 'red')
          .attr('d', `M${xScale(new Date())},0.5V${height}`);
      }
    });
  }

  chart.dates = (_) => {
    dates = _;
  };
  chart.width = (_) => {
    constWidth = _;
  };
  chart.today = (_) => {
    today = _;
  };
  chart.colors = (_) => {
    colors = _;
  };
  chart.padding = (_) => {
    padding = _;
  };
  chart.reversed = (_) => {
    reversed = _;
  };
  chart.duration = (_) => {
    duration = _;
  };

  return chart;
}
