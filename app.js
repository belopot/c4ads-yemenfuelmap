import React, { Component } from 'react';
import { render } from 'react-dom';
import { StaticMap } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import csvData from './assets/data.csv';
import $ from 'jquery';
import { gsap, Power2 } from 'gsap';
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

const parseDate = d3.timeParse("%m/%d/%Y");

const playSpeed = 1;

export default class App extends Component {

  constructor(props) {
    super(props);

    this.state = {
      selectedPort: null,
      endDate: 0
    }

    this.deckGL = React.createRef();

    this.arcData = this._getArcData(csvData);
    this.scatterplotData = this._getScatterplotData(csvData);


    /**
     * Init Slider 
     */
    this.startDate = csvData[0].decision_date.toLocaleString().split(",")[0];
    this.endDate = csvData[csvData.length - 1].decision_date.toLocaleString().split(",")[0];

    this.timelineLen = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
    this.timelineStep = this.timelineLen / (300 * playSpeed);

    this.curStartDate = this.startDate;
    this.curEndDate = this.endDate;

    minDateDom.innerHTML = this.startDate;
    maxDateDom.innerHTML = this.endDate;

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
    this.isDelay = false;

    this._updateLayerBySlider = this._updateLayerBySlider.bind(this);
    this.slider.subscribe('moving', this._updateLayerBySlider);

    this._controlTimeline = this._controlTimeline.bind(this);
    const playDom = document.getElementById('controls-play');
    playDom.addEventListener('click', this._controlTimeline);

    this._playTimeline = this._playTimeline.bind(this);

    this._histogram(csvData);

    this._moveSlider = this._moveSlider.bind(this);
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

  _controlTimeline(event) {
    if (event === undefined)
      return;

    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {
      //Play
      document.getElementById("play-path").style.display = "none";
      document.getElementById("pause-path").style.display = "block";

      var data = {
        left: parseDate(this.startDate),
        right: this.curEndDate === this.endDate ? parseDate(this.startDate) : parseDate(this.curEndDate)
      };

      this.slider.move(data, false);

      this.isDelay = true;
      this.intervalId = setInterval(this._playTimeline, 60);
    }
    else {
      //Pause
      this._pauseSlider();
    }
  }


  _playTimeline() {

    if (this.isDelay) {
      setTimeout(this._moveSlider, 1000)
    }
    else {
      this._moveSlider();
    }


  }

  _moveSlider() {

    this.curEndDate = new Date(new Date(this.curEndDate).getTime() + this.timelineStep);
    var data = {
      left: parseDate(this.startDate),
      right: this.curEndDate
    };
    this.slider.move(data, false);

    if (this.isDelay) {
      this.isDelay = false;
    }


    if (this.curEndDate === this.endDate) {
      //Stop playing
      this._pauseSlider();
    }
  }

  _pauseSlider() {
    clearInterval(this.intervalId);

    document.getElementById("play-path").style.display = "block";
    document.getElementById("pause-path").style.display = "none";

    this.isPlaying = false;
    this.isDelay = false;
  }

  _updateLayerBySlider(value) {

    const { left, right } = value;

    this.curStartDate = left.toLocaleString().split(",")[0];
    this.curEndDate = right.toLocaleString().split(",")[0];

    minDateDom.innerHTML = this.curStartDate;
    maxDateDom.innerHTML = this.curEndDate;

    //Filter data by decision_date
    let filteredData = csvData.filter(obj => new Date(obj.decision_date) >= new Date(left));
    filteredData = filteredData.filter(obj => new Date(obj.decision_date) <= new Date(right));

    this.arcData = this._getArcData(filteredData);
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
        radiusScale: 500,
        radiusMinPixels: 1,
        radiusMaxPixels: 100,
        lineWidthMinPixels: 2,
        getPosition: d => d.coordinates,
        getRadius: d => d.count,
        getFillColor: d => [50, 12, 120, 100],
        getLineColor: d => [50, 12, 120, 255],
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
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getSourceColor: [120, 12, 50, 100],
        getTargetColor: [50, 12, 120, 100],
        getWidth: 5,
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
   * Create the dataset for the arc & scatterplot
   */
  _getArcData(data) {
    let _data = [];
    for (let i = 0; i < data.length; i++) {
      const origin = data[i].Origin;
      const sourcePosition = [data[i].lon, data[i].lat, 0];
      const destination = data[i].Destination;
      const targetPosition = [data[i].dest_lon, data[i].dest_lat, 0];

      const decisionDate = data[i].decision_date;
      const fuelAmount = data[i].fuel_amount_clean;
      const fuelType = data[i].fuel_type_clean_EN;

      if (origin !== null & sourcePosition !== null & destination !== null & targetPosition !== null) {
        _data.push({
          origin: origin,
          sourcePosition: sourcePosition,
          destination: destination,
          targetPosition: targetPosition,
          decisionDate: decisionDate,
          fuelAmount: fuelAmount,
          fuelType: fuelType
        })
      }
    }
    return _data;
  }

  _getScatterplotData(data) {

    const ports = {};
    for (let i = 0; i < data.length; i++) {
      const origin = data[i].Origin;
      const sourcePosition = [data[i].lon, data[i].lat, 0];
      const destination = data[i].Destination;
      const targetPosition = [data[i].dest_lon, data[i].dest_lat, 0];
      const fuelAmount = data[i].fuel_amount_clean;

      if (destination in ports) {
        ports[destination] = {
          count: ports[destination].count + 1,
          position: targetPosition,
          fuelAmount: ports[destination].fuelAmount + fuelAmount,
        };
      } else {
        ports[destination] = {
          count: 1,
          position: targetPosition,
          fuelAmount: fuelAmount,
        };
      }
    }
    const portsMod = [];
    Object.keys(ports).forEach(function (key) {
      portsMod.push({
        port: key,
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
      const temp = csvData;
      const portTemp = this.scatterplotData;

      let filteredCsvData = temp.filter(obj => obj.Origin == object.port || obj.Destination == object.port);
      // let filteredPortData = portTemp.filter(obj => obj.port == object.port);

      this.arcData = this._getArcData(filteredCsvData);

      this.setState({
        selectedPort: object,
      })

    } else {

      this.arcData = this._getArcData(csvData);

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
      tooltip.innerHTML = `<div><span class="key key-route">Origin:</span><span class="value">${object.origin}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Destination:</span><span class="value">${object.destination}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Date:</span><span class="value">${new Date(object.decisionDate).toLocaleDateString()}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel Type:</span><span class="value">${object.fuelType || 'Untitled'}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel Amount:</span><span class="value">${object.fuelAmount || '0'}</span></div>`;
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

    const histogram = d3.histogram().value(function (d) {
      return d.decision_date;
    }).domain(x.domain()).thresholds(x.ticks(d3.timeWeek));

    const svg = d3.select("#graph").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    data.forEach(function (d) {
      d.decision_date = parseDate(d.decision_date);
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
