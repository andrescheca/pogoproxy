'use strict';

  const pogobuf = require('pogobuf'),
        io = require('socket.io-client'),
        pjson = require('./package.json');

  const config = require('./config.json'),
        proxy_namespace = io.connect(config['full_url'] + '/proxy', {query: 'version=' + pjson['version']});

  const ptc = new pogobuf.PTCLogin(),
  google = new pogobuf.GoogleLogin();

main();

/**
 * Main function.
 */
function main() {
  console.log("PokemonGo Pal Proxy Server " + pjson['version']);
  console.log('Connecting to ' + config['full_url'] + '/proxy');

  /**
  * Listens incoming connections.
  */
  proxy_namespace.on('connect', function (data) {
    console.log('Proxy connected');
  });

  /**
  * Listens 'fetch latest data' message.
  */
  proxy_namespace.on('fetch latest data', function (id, credentials) {
    fetchLatestData(id, credentials)
  });

  /**
  * Runs when the socket disconnects.
  */
  proxy_namespace.on('disconnect', function () {
    console.log('Proxy disconnected');
  });
}

  /**
  * Gets the latest data from the server.
  */
function fetchLatestData(id, credentials) {
  if (credentials.username && credentials.password && credentials.type) {
    const client = new pogobuf.Client();
    let pogopromise; 
    if (credentials.type == 'google') {
      pogopromise = google.login(credentials.username, credentials.password).then(token => {
        client.setAuthInfo('google', token);
        return client.init();
      });
    } else if (credentials.type == 'ptc') {
      pogopromise = ptc.login(credentials.username, credentials.password).then(token => {
        client.setAuthInfo('ptc', token);
        return client.init();
      });
    } else {
      proxy_namespace.emit('proxy error', id, 'No account type selected.');
    }
    if (pogopromise != undefined) {
      pogopromise.then(() => {
        return client.getInventory(0);
      }).then(inventory => {
        proxy_namespace.emit('push latest data', id, splitInventory(inventory));
      }).catch(error => {
        proxy_namespace.emit('proxy error', id, error.message);
      });
    } else {
      proxy_namespace.emit('proxy error', id, 'Could not get response from niantic servers.');
    }
  } else {
    proxy_namespace.emit('proxy error', id, 'Must send username, password and account type.');
  }  
}

/**
* Splits an inventory object.
*/
function splitInventory(inventory) {
  if (!inventory || !inventory.success || !inventory.inventory_delta || !inventory.inventory_delta.inventory_items) {
    return {};
  }

  let ret = {
    pokemon: [],
    items: [],
    pokedex: [],
    player: null,
    currency: [],
    camera: null,
    inventory_upgrades: [],
    applied_items: [],
    egg_incubators: [],
    candies: []
  };

  inventory.inventory_delta.inventory_items.forEach(item => {
    const itemdata = item.inventory_item_data;
    if (itemdata.pokemon_data) {
      ret.pokemon.push(itemdata.pokemon_data);
    }
    if (itemdata.item) {
      ret.items.push(itemdata.item);
    }
    if (itemdata.pokedex_entry) {
      ret.pokedex.push(itemdata.pokedex_entry);
    }
    if (itemdata.player_stats) {
      ret.player = itemdata.player_stats;
    }
    if (itemdata.player_currency) {
      ret.currency.push(itemdata.player_currency);
    }
    if (itemdata.player_camera) {
      ret.camera = itemdata.player_camera;
    }
    if (itemdata.inventory_upgrades) {
      ret.inventory_upgrades.push(itemdata.inventory_upgrades);
    }
    if (itemdata.applied_items) {
      ret.applied_items.push(itemdata.applied_items);
    }
    if (itemdata.egg_incubators) {
      ret.egg_incubators.push(itemdata.egg_incubators);
    }
    if (itemdata.candy) {
      ret.candies.push(itemdata.candy);
    }
  });

  return ret;
}
