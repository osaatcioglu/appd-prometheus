const _ = require('lodash')
const fetch = require('node-fetch')
const fs = require('fs')

const createSchema = async (settings) => {
  console.log(`[starting] creating ${settings.schemaName} schema...`)

  const schemaData = JSON.parse(fs.readFileSync('conf/schema.json', 'utf8'))
  const fullSchema = {
    "schema" : schemaData
  }

  const response = await fetch(`${settings.analyticsUrl}/events/schema/${settings.schemaName}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'X-Events-API-AccountName': settings.accountName,
      'X-Events-API-Key': settings.apiKey,
      'Content-type': 'application/vnd.appd.events+json;v=2'
    },
    body: JSON.stringify(fullSchema)
  });

  if(response.status !== 201){
    const responseJSON = await response.json()
  }

  if(await response.status === 201){
    console.log(`[succeeded] ${settings.schemaName} schema created`)
    return true
  }
  else{
    throw new Error(`Unable to create schema | ${responseJSON.statusCode} - ${responseJSON.message}`);
  }

  console.log(await response.status)

}

const schemaExists = async (settings) => {
  console.log(`[starting] Checking if ${settings.schemaName} schema exists...`)
  const response = await fetch(`${settings.analyticsUrl}/events/schema/${settings.schemaName}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'X-Events-API-AccountName': settings.accountName,
      'X-Events-API-Key': settings.apiKey,
      'Content-type': 'application/vnd.appd.events+json;v=2'
    }
  });

  if(response.status !== 200 || response.status !== 404){
    const responseJSON = await response.json()
  }

  switch (response.status) {
    case 200:
      console.log(`[succeeded] ${settings.schemaName} found.`)
      return true;
      break;
    case 404:
      console.log(`[succeeded] ${settings.schemaName} not found.`)
      return false;
      break;
    default:
      throw new Error(`Unable to check if schema exists | ${responseJSON.statusCode} - ${responseJSON.message}`);
      break;
  }
}

const createSchemaIfRequired = async (settings) => {
  if(!await schemaExists(settings)){
    await createSchema(settings)
  }
}

const parseData = (data) => {
  console.log(`[starting] Parsing Prometheus data...`)
  const processed = _.map(data, function(n){
    let temp = n
    temp.metric.value = n.value[1]
    temp.metric.eventTimestamp = n.value[0]

    // strip decimal
    temp.metric.eventTimestamp = temp.metric.eventTimestamp * 1000

    // flatten
    temp = temp.metric

    // remove underscore from name
    temp.name = temp.__name__
    delete temp.__name__

    temp.value = parseFloat(temp.value)

    return temp
  });
  console.log(`[succeeded] Parsed Prometheus data.`)
  return processed
}

const publishEventsToAppd = async (settings, data) => {
  console.log(`[starting] Publishing to AppD...`)

  const response = await fetch(`${settings.analyticsUrl}/events/publish/${settings.schemaName}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'X-Events-API-AccountName': settings.accountName,
      'X-Events-API-Key': settings.apiKey,
      'Content-type': 'application/vnd.appd.events+json;v=2'
    },
    body: JSON.stringify(data)
  });

  if(response.status !== 200){
    const responseJSON = await response.json()
  }

  switch (response.status) {
    case 200:
      console.log(`[succeeded] Publishing to AppD completed.`)
      return true;
      break;
    default:
      throw new Error(`Unable to update schema | ${responseJSON.statusCode} - ${responseJSON.message}`);
      break;
  }

}

module.exports = {
  publish: async function (settings, data) {
    await createSchemaIfRequired(settings)
    const parsedData = parseData(data)

    await publishEventsToAppd(settings,parsedData)
  }
};
