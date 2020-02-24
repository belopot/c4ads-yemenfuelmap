import React, { Component } from 'react';
import { render } from 'react-dom';
import { StaticMap } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import csvData from './assets/data.csv';
import $ from 'jquery';
import * as d3 from "d3";
import Slider from 'omni-slider';
import ResizeObserver from "resize-observer-polyfill";

const MAPBOX_TOKEN = process.env.MapboxAccessToken;

let INITIAL_VIEW_STATE = {
  longitude: 44.127197,
  latitude: 28.5404328,
  zoom: 4,
  maxZoom: 16,
  pitch: 60,
  bearing: 0
};

let tooltip = $(".tooltip")[0];


let minDateDom = document.getElementById('min');
let maxDateDom = document.getElementById('max');
let graphDom = document.getElementById('graph');

const parseDate = d3.timeParse("%m/%d/%Y, %I:%M:%S %p");


export default class App extends Component {

  constructor(props) {
    super(props);

    this.deckGL = React.createRef();

    //Pre-processing data
    this.csvData = csvData.filter(obj => obj.decision_date !== null);

    /**
     * Init Slider 
     */
    this.startDate = (this.csvData[0].decision_date + ", 12:00:00 AM").toLocaleString();
    this.endDate = (this.csvData[this.csvData.length - 1].decision_date + ", 12:00:00 AM").toLocaleString();

    this.curStartDate = this.startDate;
    this.curEndDate = this.endDate;

    this.timelineLen = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
    this.timelineStep = this.timelineLen / 100;

    minDateDom.innerHTML = this.startDate.split(',')[0];
    maxDateDom.innerHTML = this.endDate.split(',')[0];

    this.slider = new Slider(document.getElementById("slider"), {
      isDate: true,
      min: this.startDate,
      max: this.endDate,
      start: this.startDate,
      end: this.endDate,
      overlap: true,
      isOneWay: false,
      isDate: true
    });

    this.isPlaying = false;

    this.isPreserve = true;

    this._updateDeckLayer = this._updateDeckLayer.bind(this);
    this.slider.subscribe('moving', this._updateDeckLayer);

    //Play | Pause 
    this._controlTimeline = this._controlTimeline.bind(this);
    const playDom = document.getElementById('controls-play');
    playDom.addEventListener('click', this._controlTimeline);

    //Reset
    this._resetTimeline = this._resetTimeline.bind(this);
    const resetDom = document.getElementById('controls-restart');
    resetDom.addEventListener('click', this._resetTimeline);

    //Preserve
    this._changePreserve = this._changePreserve.bind(this);
    const preserveDom = document.getElementById('preseve');
    preserveDom.addEventListener('change', this._changePreserve);
    preserveDom.checked = this.isPreserve;


    this._addInterval = this._addInterval.bind(this);
    this._updateSlider = this._updateSlider.bind(this);

    //Init drawing

    this.arcData = this.csvData.filter(obj => obj.Origin !== null & obj.Destination !== null);
    this.scatterplotData = this._getScatterplotData(this.csvData);
    this.state = {
      selectedPort: null,
    }

    this.filteredDataByDate = this.csvData;

    this._histogram(this.csvData);

  }

  componentDidMount() {
    this.resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;

      this.setState({
        width: Math.floor(width),
        height: Math.floor(height)
      });

    });

    this.resizeObserver.observe(document.getElementById('app'));
  }

  componentWillUnmount() {
    this.resizeObserver.disconnect();
  }

  _changePreserve(event) {
    this.isPreserve = event.currentTarget.checked;
  }

  _resetTimeline(event) {
    if (this.isPlaying) {
      this._pauseSlider();
    }

    this.curStartDate = this.startDate;
    this.curEndDate = this.endDate;

    var data = {
      left: parseDate(this.curStartDate),
      right: parseDate(this.curEndDate)
    };

    this.slider.move(data, false);
  }

  _controlTimeline(event) {
    if (event === undefined)
      return;

    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {

      //Play
      document.getElementById("play-path").style.display = "none";
      document.getElementById("pause-path").style.display = "block";


      if (this.curEndDate === this.endDate) {
        this.curStartDate = this.startDate;
        this.curEndDate = new Date(new Date(this.startDate).getTime() + this.timelineStep * 2).toLocaleString();

        var data = {
          left: parseDate(this.curStartDate),
          right: parseDate(this.curEndDate)
        };

        this.slider.move(data, false);

        //For delay
        setTimeout(this._addInterval, 1000);
      }
      else {
        this._addInterval();
      }


    }
    else {
      //Pause
      this._pauseSlider();
    }
  }

  _addInterval() {
    this.curInterval = setInterval(this._updateSlider, 300);
  }

  _updateSlider() {

    if (!this.isPreserve) {
      this.curStartDate = new Date(new Date(this.curStartDate).getTime() + this.timelineStep).toLocaleString();
    }

    this.curEndDate = new Date(new Date(this.curEndDate).getTime() + this.timelineStep).toLocaleString();

    var data = {
      left: parseDate(this.curStartDate),
      right: parseDate(this.curEndDate)
    };

    this.slider.move(data, false);

    if (this.curEndDate === this.endDate) {
      //Stop playing
      this._pauseSlider();
    }
  }

  _pauseSlider() {

    clearInterval(this.curInterval);

    document.getElementById("play-path").style.display = "block";
    document.getElementById("pause-path").style.display = "none";

    this.isPlaying = false;
  }

  _updateDeckLayer(value) {

    const { left, right } = value;

    this.curStartDate = left.toLocaleString();
    this.curEndDate = right.toLocaleString();

    minDateDom.innerHTML = left.toLocaleString().split(',')[0];
    maxDateDom.innerHTML = right.toLocaleString().split(',')[0];

    //Filter data by decision_date
    let filteredData = this.csvData.filter(obj => new Date(obj.decision_date) >= new Date(left));
    filteredData = filteredData.filter(obj => new Date(obj.decision_date) <= new Date(right));

    this.filteredDataByDate = filteredData;

    //Draw data
    this.arcData = filteredData.filter(obj => obj.Origin !== null & obj.Destination !== null);;
    this.scatterplotData = this._getScatterplotData(filteredData);
    this.setState({
      selectedPort: null,
    })

  }

  _renderLayers() {
    return [
      new ScatterplotLayer({
        id: 'scatterplot-layer',
        data: this.scatterplotData,
        pickable: true,
        opacity: 0.8,
        stroked: true,
        filled: true,
        radiusScale: 1100,
        radiusMinPixels: 1,
        radiusMaxPixels: 100,
        lineWidthMinPixels: 2,
        getPosition: d => d.coordinates,
        getRadius: d => d.count + 20,
        getFillColor: d => d.color,
        getLineColor: d => [d.color[0], d.color[1], d.color[2], 255],
        autoHighlight: true,
        highlightColor: [249, 205, 23, 180],
        onHover: (info, event) => {
          this._scatterplotTooltip(info.x, info.y, info.object)
          this._scatterplotFilterData(info.object);
        },
        onClick: (info, evnet) => {
          // this._scatterplotFilterData(info.object);
        },

      }),
      new ArcLayer({
        id: 'arc',
        data: this.arcData,
        getSourcePosition: d => [d.lon, d.lat, 0],
        getTargetPosition: d => [d.dest_lon, d.dest_lat, 0],
        getSourceColor: [120, 12, 50, 100],
        getTargetColor: [50, 12, 120, 100],
        getWidth: 4,
        pickable: true,
        autoHighlight: true,
        highlightColor: [249, 205, 23, 250],
        onHover: this._arcTooltip,
      })
    ];
  }

  render() {

    const { mapStyle = 'mapbox://styles/mapbox/light-v9' } = this.props;

    return (
      <DeckGL ref={this.deckGL} layers={this._renderLayers()} initialViewState={INITIAL_VIEW_STATE} controller={true}>
        <StaticMap
          reuseMaps
          mapStyle={mapStyle}
          preventStyleDiffing={true}
          mapboxApiAccessToken={MAPBOX_TOKEN}
        />
      </DeckGL>
    );
  }



  /**
   * Create the dataset for the scatterplot
   */
  _getScatterplotData(data) {

    const ports = {};
    for (let i = 0; i < data.length; i++) {
      const origin = data[i].Origin;
      const sourcePosition = [data[i].lon, data[i].lat, 0];
      const destination = data[i].Destination;
      const targetPosition = [data[i].dest_lon, data[i].dest_lat, 0];
      const fuelAmount = data[i].fuel_amount_clean;

      //Destination
      if (destination !== null) {
        if (destination in ports) {
          ports[destination] = {
            color: [50, 12, 120, 100],
            count: ports[destination].count + 1,
            position: targetPosition,
            fuelAmount: ports[destination].fuelAmount + fuelAmount,
          };
        } else {
          ports[destination] = {
            color: [50, 12, 120, 100],
            count: 1,
            position: targetPosition,
            fuelAmount: fuelAmount,
          };
        }
      }

      //Origin
      if (origin !== null) {
        if (origin in ports) {
          ports[origin] = {
            color: [120, 12, 50, 100],
            count: ports[origin].count + 1,
            position: sourcePosition,
            fuelAmount: ports[origin].fuelAmount + fuelAmount,
          };
        } else {
          ports[origin] = {
            color: [120, 12, 50, 100],
            count: 1,
            position: sourcePosition,
            fuelAmount: fuelAmount,
          };
        }
      }

    }
    const portsMod = [];
    Object.keys(ports).forEach(function (key) {
      portsMod.push({
        port: key,
        color: ports[key].color,
        count: ports[key].count,
        fuelAmount: ports[key].fuelAmount,
        coordinates: ports[key].position
      });
    });
    return portsMod;
  }

  /**
   * Filter data
   */

  _scatterplotFilterData(object) {
    if (object) {

      const temp = this.filteredDataByDate;
      let filteredData = temp.filter(obj => obj.Origin == object.port || obj.Destination == object.port);

      this.arcData = filteredData.filter(obj => obj.Origin !== null & obj.Destination !== null);
      this.scatterplotData = this._getScatterplotData(filteredData);

      this.setState({
        selectedPort: object,
      })

    } else {

      this.arcData = this.filteredDataByDate.filter(obj => obj.Origin !== null & obj.Destination !== null);
      this.scatterplotData = this._getScatterplotData(this.filteredDataByDate);

      this.setState({
        selectedPort: null,
      })

    }
  }

  /**
   * Tooltip
   */

  //Scatterplot Tooltip
  _scatterplotTooltip(x, y, object) {

    if (object) {
      tooltip.style.top = `${y}px`;
      tooltip.style.left = `${x}px`;
      tooltip.innerHTML = `<div><span class="key key-route">Port:</span><span class="value">${object.port}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">count:</span><span class="value">${object.count}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel amount:</span><span class="value">${object.fuelAmount}</span></div>`;
      tooltip.style.opacity = 1;
    } else {
      tooltip.innerHTML = '';
      tooltip.style.opacity = 0;
    }
  }

  //Arc Tooltip
  _arcTooltip({ x, y, object }) {
    if (object) {
      tooltip.style.top = `${y}px`;
      tooltip.style.left = `${x}px`;
      tooltip.innerHTML = `<div><span class="key key-route">Origin:</span><span class="value">${object.Origin}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Destination:</span><span class="value">${object.Destination}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Date:</span><span class="value">${new Date(object.decision_date).toLocaleDateString()}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel Type:</span><span class="value">${object.fuel_type_clean_EN || 'Untitled'}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel Amount:</span><span class="value">${object.fuel_amount_clean || '0'}</span></div>`;
      tooltip.style.opacity = 1;
    } else {
      tooltip.innerHTML = '';
      tooltip.style.opacity = 0;
    }
  }

  _histogram(data) {


    const margin = {
      top: 0,
      right: 0,
      bottom: 5,
      left: 0
    }

    const width = graphDom.offsetWidth;
    const height = 40 - margin.top - margin.bottom;


    const x = d3.scaleTime().domain([
      new Date(this.startDate),
      new Date(this.endDate)
    ]).rangeRound([0, width]);

    const y = d3.scaleLinear().range([height, 0]);

    const parse_Date = d3.timeParse("%m/%d/%Y");
    const histogram = d3.histogram().value(function (d) {
      return d.decision_date;
    }).domain(x.domain()).thresholds(x.ticks(d3.timeWeek));

    const svg = d3.select("#graph").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    data.forEach(function (d) {
      d.decision_date = parse_Date(d.decision_date);
    });

    const bins = histogram(data);

    y.domain([
      0,
      d3.max(bins, function (d) {
        return d.length;
      })
    ]);

    svg.selectAll("rect").data(bins).enter().append("rect").attr("class", "bar").attr("x", 1).attr("transform", function (d) {
      return "translate(" + x(d.x0) + "," + y(d.length) + ")";
    }).attr("width", function (d) {
      return x(d.x1) - x(d.x0) - 1 > 0 ? x(d.x1) - x(d.x0) - 1 : 0;
    }).attr("height", function (d) {
      return height - y(d.length);
    });
  }

}

export function renderToDOM(container) {
  render(<App />, container);
}
