import React, { Component } from 'react';
import { render } from 'react-dom';
import { StaticMap } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import CSVDATA from './assets/data.csv';

// Set your mapbox token here
const MAPBOX_TOKEN = process.env.MapboxAccessToken; // eslint-disable-line

let INITIAL_VIEW_STATE = {
  longitude: -74,
  latitude: 40.7,
  zoom: 5,
  maxZoom: 16,
  pitch: 0,
  bearing: 0
};

export default class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      hoveredPort: null,
      selectedPort: null
    }
  }

  componentWillMount() {
    this.arcData = this._getArcData(CSVDATA);
    this.scatterplotData = this._getScatterplotData(CSVDATA);

    //initialize lon & lat
    for (let i = 0; this.scatterplotData.length; i++) {
      if (this.scatterplotData[i].coordinates) {
        INITIAL_VIEW_STATE.longitude = this.scatterplotData[i].coordinates[0];
        INITIAL_VIEW_STATE.latitude = this.scatterplotData[i].coordinates[1];
        break;
      }
    }
  }

  _renderLayers() {

    return [
      new ScatterplotLayer({
        id: 'scatter-plot',
        data: this.scatterplotData,
        pickable: true,
        radiusScale: 300,
        getRadius: d => d.count,
        getPosition: d => d.coordinates,
        getColor: d => [0, 50, 90, 180],
        autoHighlight: true,
        highlightColor: [50, 12, 120, 100]
      }),
      new ArcLayer({
        id: 'arc',
        data: this.arcData,
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getSourceColor: [120, 12, 50, 100],
        getTargetColor: [50, 12, 120, 100],
        getWidth: 5
      })
    ];
  }

  render() {
    const { mapStyle = 'mapbox://styles/mapbox/light-v9' } = this.props;

    return (
      <DeckGL layers={this._renderLayers()} initialViewState={INITIAL_VIEW_STATE} controller={true}>
        <StaticMap
          reuseMaps
          mapStyle={mapStyle}
          preventStyleDiffing={true}
          mapboxApiAccessToken={MAPBOX_TOKEN}
        />
      </DeckGL>
    );
  }


  ///////////////////////////////////////////////////////////////
  //Create the dataset for the arc & scatterplot
  ///////////////////////////////////////////////////////////////
  // application_num: 1
  // decision_date: "2018-10-20"
  // offloading_port_cleaned_EN: "Mukalla, Yemen"
  // loading_port_cleaned_EN: null
  // fuel_amount_clean: 5000
  // fuel_type_clean_EN: "Petrol"
  // lon: null
  // lat: null
  // Origin: null
  // dest_lat: 49.127197
  // dest_lon: 14.5404328
  // Destination: "Mukalla, Yemen"
  _getArcData(data) {
    let arcData = [];
    for (let i = 0; i < data.length; i++) {
      const origin = data[i].Origin;
      const sourcePosition = [data[i].lon, data[i].lat, 0];
      const destination = data[i].Destination;
      const targetPosition = [data[i].dest_lon, data[i].dest_lat, 0];
      if (origin !== null & sourcePosition !== null & destination !== null & targetPosition !== null) {
        arcData.push({
          sourcePosition: sourcePosition,
          targetPosition: targetPosition
        })
      }
    }
    return arcData;
  }
  _getScatterplotData(data) {

    const ports = {};
    const group = [];
    for (let i = 0; i < data.length; i++) {
      const origin = data[i].Origin;
      const sourcePosition = [data[i].lon, data[i].lat, 0];
      const destination = data[i].Destination;
      const targetPosition = [data[i].dest_lon, data[i].dest_lat, 0];

      if (destination in ports) {
        ports[destination] = {
          count: ports[destination].count + 1,
          position: targetPosition
        };
      } else {
        ports[destination] = {
          count: 1,
          position: targetPosition
        };
      }
    }
    const portsMod = [];
    Object.keys(ports).forEach(function (key) {
      portsMod.push({
        port: key,
        count: ports[key].count,
        coordinates: ports[key].position
      });
    });
    return portsMod;
  }


}

export function renderToDOM(container) {
  render(<App />, container);
}
