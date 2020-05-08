import React, { Component, Fragment } from 'react';
import ReactDOM from 'react-dom';

import { render } from 'react-dom';
import { StaticMap } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import csvData from './assets/data.csv';
import $ from 'jquery';
import * as d3 from "d3";
import Slider from 'omni-slider';
import ResizeObserver from "resize-observer-polyfill";



import MyExpansionPanel from '@material-ui/core/ExpansionPanel';
import MyExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import MyExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import MyExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import { withStyles, makeStyles } from '@material-ui/core/styles';

import { Picky } from 'react-picky';

const analyticsFontColor = '#c7c7c7';

const ExpansionPanel = withStyles({
  root: {
  },
})(MyExpansionPanel);



const ExpansionPanelSummary = withStyles(theme => ({
  root: {
    backgroundColor: 'rgb(39, 39, 39)',
    color: analyticsFontColor,
  },
  content: {
    fontSize: '100px'
  },
}))(MyExpansionPanelSummary);

const ExpansionPanelDetails = withStyles({
  root: {
    backgroundColor: 'rgba(20, 20, 20, 1)',
    color: analyticsFontColor,
    height: window.innerHeight - 130,
    maxHeight: window.innerHeight - 130,
    overflowY: 'auto'
  },
})(MyExpansionPanelDetails);

const ExpandMoreIcon = withStyles({
  root: {
    color: analyticsFontColor,
  },
})(MyExpandMoreIcon);


const MAPBOX_TOKEN = process.env.MapboxAccessToken;

let INITIAL_VIEW_STATE = {
  longitude: 44.127197,
  latitude: 28.5404328,
  zoom: 4,
  maxZoom: 16,
  pitch: 60,
  bearing: 0
};

const DestColor = [248, 229, 200, 100];
const SourceColor = [212, 173, 109, 100];

let tooltip = $(".tooltip")[0];


let minDateDom = document.getElementById('min');
let maxDateDom = document.getElementById('max');
let graphDom = document.getElementById('graph');

const parseDate = d3.timeParse("%m/%d/%Y, %I:%M:%S %p");

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


export default class App extends Component {


  constructor(props) {
    super(props);

    this.state = {
      selectedPort: null,
      analyticsExpanded: true,
    }

    this._fuelAmount = 0;
    this._shipments = 0;
    this._involvedPorts = 0;

    //Filter options
    this._filterOptionsImporter = [];
    this._filterOptionsExporter = [];
    this._filterOptionsOrigin = [];
    this._filterOptionsDest = [];
    this._filterOptionsEstMonth = [];
    this._filterOptionsFuelType = [];

    this._selectedImporter = [];
    this._selectedExporter = [];
    this._selectedOrigin = [];
    this._selectedDest = [];
    this._selectedEstMonth = [];
    this._selectedFuelType = [];

    //Bind
    this.handleExpand = this.handleExpand.bind(this);

    this._onFilterByImporter = this._onFilterByImporter.bind(this);
    this._onFilterByExporter = this._onFilterByExporter.bind(this);
    this._onFilterByOrigin = this._onFilterByOrigin.bind(this);
    this._onFilterByDest = this._onFilterByDest.bind(this);
    this._onFilterByEstMonth = this._onFilterByEstMonth.bind(this);
    this._onFilterByFuelType = this._onFilterByFuelType.bind(this);

    this._arcTooltip = this._arcTooltip.bind(this);
    this._scatterplotTooltip = this._scatterplotTooltip.bind(this);



    this.deckGL = React.createRef();

    //Pre-processing data
    // this.csvData = csvData.filter(obj => obj.decision_date !== null);
    this.csvData = csvData;

    //Sort by date
    this.csvData.sort((a, b) => new Date(a.decision_date) - new Date(b.decision_date));


    //Filtered Data
    this.filteredDataImporter = this.csvData;
    this.filteredDataExporter = this.csvData;
    this.filteredDataOrigin = this.csvData;
    this.filteredDataDest = this.csvData;
    this.filteredDataEstMonth = this.csvData;
    this.filteredDataFuelType = this.csvData;
    this.filteredDataDecision = this.csvData;
    this.finalData = this.csvData;

    /**
     * Init Slider 
     */
    this.startDate = (this.finalData[0].decision_date + ", 12:00:00 AM").toLocaleString();
    this.endDate = (this.finalData[this.finalData.length - 1].decision_date + ", 12:00:00 AM").toLocaleString();

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

    this._moveTimeline = this._moveTimeline.bind(this);
    this.slider.subscribe('moving', this._moveTimeline);

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

    this.arcData = this._getArcData(this.finalData);
    this.scatterplotData = this._getScatterplotData(this.finalData);



    this._histogram(this.finalData);

    this._analytics(this.finalData);

    this._getFilterOptions();

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

  _getFilterOptions() {

    this._filterOptionsImporter = [];
    this._filterOptionsExporter = [];
    this._filterOptionsOrigin = [];
    this._filterOptionsDest = [];
    this._filterOptionsEstMonth = [];
    this._filterOptionsFuelType = [];

    const ImporterJson = {};
    const ExporterJson = {};
    const OriginJson = {};
    const DestJson = {};
    const EstMonthJson = {};
    const FuelTypeJson = {};

    for (let i = 0; i < this.csvData.length; i++) {

      //importer
      const importer = this.csvData[i].importer_proxy;
      if (importer !== null) {
        if (importer in ImporterJson) {
        } else {
          ImporterJson[importer] = {
            name: importer,
          };
          this._filterOptionsImporter.push({ name: importer, id: this._filterOptionsImporter.length });
        }
      }


      //exporter
      const exporter = this.csvData[i].exporter_proxy;
      if (exporter !== null) {
        if (exporter in ExporterJson) {
        } else {
          ExporterJson[exporter] = {
            name: exporter,
          };
          this._filterOptionsExporter.push({ name: exporter, id: this._filterOptionsExporter.length });
        }
      }

      //Origin
      const origin = this.csvData[i].Origin;
      if (origin !== null) {
        if (origin in OriginJson) {
        } else {
          OriginJson[origin] = {
            name: origin,
          };
          this._filterOptionsOrigin.push({ name: origin, id: this._filterOptionsOrigin.length });
        }
      }

      //Dest
      const dest = this.csvData[i].Destination;
      if (dest !== null) {
        if (dest in DestJson) {
        } else {
          DestJson[dest] = {
            name: dest,
          };
          this._filterOptionsDest.push({ name: dest, id: this._filterOptionsDest.length });
        }
      }

      //Est month
      let estMonth = this.csvData[i].decision_date;
      if (estMonth !== null) {
        estMonth = monthNames[new Date(this.csvData[i].decision_date).getMonth()] + " " + new Date(this.csvData[i].decision_date).getFullYear();
        if (estMonth in EstMonthJson) {
        } else {
          EstMonthJson[estMonth] = {
            name: estMonth,
          };
          this._filterOptionsEstMonth.push({ name: estMonth, id: this._filterOptionsEstMonth.length });
        }
      }

      //Fuel type
      const fuelType = this.csvData[i].fuel_type_clean_EN;
      if (fuelType !== null) {
        if (fuelType in FuelTypeJson) {
        } else {
          FuelTypeJson[fuelType] = {
            name: fuelType,
          };
          this._filterOptionsFuelType.push({ name: fuelType, id: this._filterOptionsFuelType.length });
        }
      }

    }


    this._selectedImporter = this._filterOptionsImporter;
    this._selectedExporter = this._filterOptionsExporter;
    this._selectedOrigin = this._filterOptionsOrigin;
    this._selectedDest = this._filterOptionsDest;
    this._selectedEstMonth = this._filterOptionsEstMonth;
    this._selectedFuelType = this._filterOptionsFuelType;

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

  _moveTimeline(value) {

    const { left, right } = value;

    this.curStartDate = left.toLocaleString();
    this.curEndDate = right.toLocaleString();

    minDateDom.innerHTML = left.toLocaleString().split(',')[0];
    maxDateDom.innerHTML = right.toLocaleString().split(',')[0];

    //Filter data by decision_date
    let filteredData = this.filteredDataFuelType.filter(obj => new Date(obj.decision_date) >= new Date(left));
    filteredData = filteredData.filter(obj => new Date(obj.decision_date) <= new Date(right));

    this.filteredDataDecision = filteredData;

    this.finalData = this.filteredDataDecision;

    //Draw data
    this._analytics(this.finalData);
    this.arcData = this._getArcData(this.finalData);
    this.scatterplotData = this._getScatterplotData(this.finalData);
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
        getRadius: d => d.fuelAmount / 15000 + 20,
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
        getSourceColor: SourceColor,
        getTargetColor: DestColor,
        widthScale: 1,
        getWidth: d => 20 * Math.log10(d.shipments / 10 + 1.5),
        pickable: true,
        autoHighlight: true,
        highlightColor: [249, 205, 23, 250],
        onHover: this._arcTooltip,
        // onClick: this._arcTooltip,
      })
    ];
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
            color: DestColor,
            shipments: ports[destination].shipments + 1,
            position: targetPosition,
            fuelAmount: ports[destination].fuelAmount + fuelAmount,
          };
        } else {
          ports[destination] = {
            color: DestColor,
            shipments: 1,
            position: targetPosition,
            fuelAmount: fuelAmount,
          };
        }
      }

      //Origin
      if (origin !== null) {
        if (origin in ports) {
          ports[origin] = {
            color: SourceColor,
            shipments: ports[origin].shipments + 1,
            position: sourcePosition,
            fuelAmount: ports[origin].fuelAmount + fuelAmount,
          };
        } else {
          ports[origin] = {
            color: SourceColor,
            shipments: 1,
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
        shipments: ports[key].shipments,
        fuelAmount: ports[key].fuelAmount,
        coordinates: ports[key].position
      });
    });


    return portsMod;
  }


  _getArcData(_data) {
    const data = _data.filter(obj => obj.Origin !== null & obj.Destination !== null);

    const arcs = {};
    for (let i = 0; i < data.length; i++) {

      const decisionDate = data[i].decision_date;
      const fuelAmount = data[i].fuel_amount_clean;
      const fuelType = data[i].fuel_type_clean_EN;
      const origin = data[i].Origin;
      const lon = data[i].lon;
      const lat = data[i].lat;
      const destination = data[i].Destination;
      const destLon = data[i].dest_lon;
      const destLat = data[i].dest_lat;

      const shipmentName = origin + " -> " + destination;

      //Destination
      if (shipmentName in arcs) {
        let shipmentInfo = arcs[shipmentName].shipmentInfo;
        shipmentInfo.push({ decisionDate: decisionDate, fuelType: fuelType, fuelAmount: fuelAmount });

        arcs[shipmentName] = {
          shipments: arcs[shipmentName].shipments + 1,
          Origin: origin,
          lon: lon,
          lat: lat,
          Destination: destination,
          dest_lon: destLon,
          dest_lat: destLat,
          fuelAmount: arcs[shipmentName].fuelAmount + fuelAmount,
          shipmentInfo: shipmentInfo
        };
      } else {
        arcs[shipmentName] = {
          shipments: 1,
          Origin: origin,
          lon: lon,
          lat: lat,
          Destination: destination,
          dest_lon: destLon,
          dest_lat: destLat,
          fuelAmount: fuelAmount,
          shipmentInfo: [{ decisionDate: decisionDate, fuelType: fuelType, fuelAmount: fuelAmount }]
        };
      }

    }

    const arcsMod = [];
    Object.keys(arcs).forEach(function (key) {
      arcsMod.push({
        shipmentName: key,
        shipments: arcs[key].shipments,
        Origin: arcs[key].Origin,
        lon: arcs[key].lon,
        lat: arcs[key].lat,
        Destination: arcs[key].Destination,
        dest_lon: arcs[key].dest_lon,
        dest_lat: arcs[key].dest_lat,
        fuelAmount: arcs[key].fuelAmount,
        shipmentInfo: arcs[key].shipmentInfo
      });
    });

    return arcsMod;

  }


  /**
   * Filter data
   */

  _scatterplotFilterData(object) {
    if (object) {

      const temp = this.finalData;
      let filteredData = temp.filter(obj => obj.Origin == object.port || obj.Destination == object.port);

      this._analytics(filteredData);
      this.arcData = this._getArcData(filteredData);
      this.scatterplotData = this._getScatterplotData(filteredData);

      this.setState({
        selectedPort: object,
      })

    } else {
      this._analytics(this.finalData);
      this.arcData = this._getArcData(this.finalData);
      this.scatterplotData = this._getScatterplotData(this.finalData);

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
      tooltip.innerHTML += `<div><span class="key key-route">Shipments:</span><span class="value">${this.numberWithCommas(object.shipments)}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel Amount:</span><span class="value">${this.numberWithCommas(object.fuelAmount)}</span></div>`;
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
      tooltip.innerHTML += `<div><span class="key key-route">Shipments:</span><span class="value">${this.numberWithCommas(object.shipments)}</span></div>`;
      tooltip.innerHTML += `<div><span class="key key-route">Fuel Amount:</span><span class="value">${this.numberWithCommas(object.fuelAmount)}</span></div>`;

      tooltip.innerHTML += `<div><table><colgroup><col width="40%"><col width="30%"><col width="30%"></colgroup><thead><tr><th></th><th></th><th></th></tr></thead><tbody id='tdata'></tbody></table></div>`;

      tooltip.style.opacity = 1;

      let td = document.getElementById('tdata');
      for (let i = 0; i < object.shipmentInfo.length; i++) {
        let info = object.shipmentInfo[i];
        td.innerHTML += `<tr><td>${new Date(info.decisionDate).toLocaleString().split(',')[0]}</td><td>${info.fuelType}</td><td>${this.numberWithCommas(info.fuelAmount)}</td></tr>`;
      }
    } else {
      tooltip.innerHTML = '';
      tooltip.style.opacity = 0;
    }
  }

  _histogram(data) {

    graphDom.innerHTML = "";


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

  _analytics(data) {
    this._fuelAmount = 0;
    this._shipments = 0;
    this._involvedPorts = 0;

    let portJson = {};
    let ports = [];

    for (let i = 0; i < data.length; i++) {

      //Fuel amount
      this._fuelAmount += data[i].fuel_amount_clean;

      //Shipments
      this._shipments++;

      //involved Ports
      let origin = data[i].Origin;
      if (origin !== null) {
        if (origin in portJson) {
        }
        else {
          portJson[origin] = {
            name: origin,
          };
          ports.push({ name: origin });
        }

      }

      let dest = data[i].Destination;
      if (dest !== null) {
        if (dest in portJson) {
        }
        else {
          portJson[dest] = {
            name: dest,
          };
          ports.push({ name: dest });
        }

      }

    }

    this._involvedPorts = ports.length;

  }

  _onFilterByImporter(selectedList) {

    this._selectedImporter = selectedList;

    this.filterData();
    this.drawData();

  }

  _onFilterByExporter(selectedList, selectedItem) {

    this._selectedExporter = selectedList;

    this.filterData();
    this.drawData();

  }

  _onFilterByOrigin(selectedList, selectedItem) {

    this._selectedOrigin = selectedList;

    this.filterData();
    this.drawData();

  }

  _onFilterByDest(selectedList, selectedItem) {

    this._selectedDest = selectedList;

    this.filterData();
    this.drawData();

  }

  _onFilterByEstMonth(selectedList, selectedItem) {

    this._selectedEstMonth = selectedList;

    this.filterData();
    this.drawData();

  }

  _onFilterByFuelType(selectedList, selectedItem) {

    this._selectedFuelType = selectedList;

    this.filterData();
    this.drawData();

  }


  numberWithCommas(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  drawData() {
    this._analytics(this.finalData);
    this.arcData = this._getArcData(this.finalData);
    this.scatterplotData = this._getScatterplotData(this.finalData);

    this.setState({
      selectedPort: null,
    })
  }

  filterData() {
    let str;
    //Filter by Importer
    str = "";
    for (let i = 0; i < this._selectedImporter.length; i++) {
      str += this._selectedImporter[i].name + "#";
    }
    this.filteredDataImporter = this.csvData.filter(obj => str.indexOf(obj.importer_proxy) >= 0 || obj.importer_proxy == null);

    //Filter by Exporter
    str = "";
    for (let i = 0; i < this._selectedExporter.length; i++) {
      str += this._selectedExporter[i].name + "#";
    }
    this.filteredDataExporter = this.filteredDataImporter.filter(obj => str.indexOf(obj.exporter_proxy) >= 0 || obj.exporter_proxy == null);


    //Filter by Origin
    str = "";
    for (let i = 0; i < this._selectedOrigin.length; i++) {
      str += this._selectedOrigin[i].name + "#";
    }
    this.filteredDataOrigin = this.filteredDataExporter.filter(obj => str.indexOf(obj.Origin) >= 0 || obj.Origin == null);


    //Filter by Dest
    str = "";
    for (let i = 0; i < this._selectedDest.length; i++) {
      str += this._selectedDest[i].name + "#";
    }
    this.filteredDataDest = this.filteredDataOrigin.filter(obj => str.indexOf(obj.Destination) >= 0 || obj.Destination == null);

    //Filter by EstMonth
    str = "";
    for (let i = 0; i < this._selectedEstMonth.length; i++) {
      str += this._selectedEstMonth[i].name + "#";
    }
    this.filteredDataEstMonth = this.filteredDataDest.filter(obj => str.indexOf(monthNames[new Date(obj.decision_date).getMonth()] + " " + new Date(obj.decision_date).getFullYear()) >= 0);

    //Filter by Fuel type
    str = "";
    for (let i = 0; i < this._selectedFuelType.length; i++) {
      str += this._selectedFuelType[i].name + "#";
    }
    this.filteredDataFuelType = this.filteredDataEstMonth.filter(obj => str.indexOf(obj.fuel_type_clean_EN) >= 0 || obj.fuel_type_clean_EN == null);



    //Filter by Decision date
    let filteredData = this.filteredDataFuelType.filter(obj => new Date(obj.decision_date.toLocaleString()) >= new Date(this.curStartDate));
    this.filteredDataDecision = filteredData.filter(obj => new Date(obj.decision_date.toLocaleString()) <= new Date(this.curEndDate));

    this.finalData = this.filteredDataDecision;
    
  }

  handleExpand(event, newExpanded) {
    this.setState({ analyticsExpanded: newExpanded });
  }

  render() {

    const { mapStyle = 'mapbox://styles/mapbox/dark-v10' } = this.props;


    return (
      <Fragment>
        <DeckGL ref={this.deckGL} layers={this._renderLayers()} initialViewState={INITIAL_VIEW_STATE} controller={true}>
          <StaticMap
            reuseMaps
            mapStyle={mapStyle}
            preventStyleDiffing={true}
            mapboxApiAccessToken={MAPBOX_TOKEN}
          />
        </DeckGL>
        <div className="analytics">
          <ExpansionPanel
            className="analytics-expansion"
            expanded={this.state.analyticsExpanded}
            onChange={this.handleExpand}
          >
            <ExpansionPanelSummary
              expandIcon={<ExpandMoreIcon className="expansion-icon" />}
              className="analytics-expansion-header"
            >
              <Typography className="app-title">Yemen Fuel Map</Typography>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails>
              <List>
                <Typography className="analytics-title">
                  Analytics
                </Typography>
                <Typography className="analytics-item-value">
                  {this.numberWithCommas(this._fuelAmount)}
                </Typography>
                <Typography className="analytics-item">
                  MT
                </Typography>
                <Typography className="analytics-item-value">
                  {this.numberWithCommas(this._shipments)}
                </Typography>
                <Typography className="analytics-item">
                  Shipments
                </Typography>
                <Typography className="analytics-item-value">
                  {this.numberWithCommas(this._involvedPorts)}
                </Typography>
                <Typography className="analytics-item">
                  Involved Ports
                </Typography>
                <Divider className="divider" />
                <Typography className="analytics-title">
                  Filters
                </Typography>
                <Typography className="analytics-item">
                  Importer
                </Typography>

                <Picky
                  id="pickyImporter"
                  value={this._selectedImporter}
                  options={this._filterOptionsImporter}
                  onChange={this._onFilterByImporter}
                  open={false}
                  keepOpen={true}
                  numberDisplayed={3}
                  valueKey="id"
                  labelKey="name"
                  multiple={true}
                  includeSelectAll={true}
                  dropdownHeight={37 * this._filterOptionsImporter.length}
                />

                <Divider className="divider" />
                <Typography className="analytics-item">
                  Exporter
                </Typography>

                <Picky
                  id="pickyExporter"
                  value={this._selectedExporter}
                  options={this._filterOptionsExporter}
                  onChange={this._onFilterByExporter}
                  open={false}
                  keepOpen={true}
                  numberDisplayed={3}
                  valueKey="id"
                  labelKey="name"
                  multiple={true}
                  includeSelectAll={true}
                  dropdownHeight={37 * this._filterOptionsExporter.length}
                />

                <Divider className="divider" />
                <Typography className="analytics-item">
                  Port of Origin
                </Typography>

                <Picky
                  id="pickyOrigin"
                  value={this._selectedOrigin}
                  options={this._filterOptionsOrigin}
                  onChange={this._onFilterByOrigin}
                  open={false}
                  keepOpen={true}
                  numberDisplayed={3}
                  valueKey="id"
                  labelKey="name"
                  multiple={true}
                  includeSelectAll={true}
                  dropdownHeight={37 * this._filterOptionsOrigin.length}
                />

                <Divider className="divider" />
                <Typography className="analytics-item">
                  Destination Port
                </Typography>

                <Picky
                  id="pickyDest"
                  value={this._selectedDest}
                  options={this._filterOptionsDest}
                  onChange={this._onFilterByDest}
                  open={false}
                  keepOpen={true}
                  numberDisplayed={3}
                  valueKey="id"
                  labelKey="name"
                  multiple={true}
                  includeSelectAll={true}
                  dropdownHeight={37 * this._filterOptionsDest.length}
                />

                <Divider className="divider" />
                <Typography className="analytics-item">
                  Estimated Month of Arrival
                </Typography>

                <Picky
                  id="pickyEstMonth"
                  value={this._selectedEstMonth}
                  options={this._filterOptionsEstMonth}
                  onChange={this._onFilterByEstMonth}
                  open={false}
                  keepOpen={true}
                  numberDisplayed={3}
                  valueKey="id"
                  labelKey="name"
                  multiple={true}
                  includeSelectAll={true}
                  dropdownHeight={37 * this._filterOptionsEstMonth.length}
                />

                <Divider className="divider" />
                <Typography className="analytics-item">
                  Type of Fuel
                </Typography>

                <Picky
                  id="pickyFuelType"
                  value={this._selectedFuelType}
                  options={this._filterOptionsFuelType}
                  onChange={this._onFilterByFuelType}
                  open={false}
                  keepOpen={true}
                  numberDisplayed={3}
                  valueKey="id"
                  labelKey="name"
                  multiple={true}
                  includeSelectAll={true}
                  dropdownHeight={37 * this._filterOptionsFuelType.length}
                />

                <Divider className="divider" />
              </List>

            </ExpansionPanelDetails>
          </ExpansionPanel>
        </div>
      </Fragment>
    );
  }
}

ReactDOM.render(<App />, document.querySelector('#app'));