const maxDataSize = 64000;

var peerConnection;
var uuid;
var serverConnection;
var dataChannel = this;
var img;
var data = this;
var dataMode = this;
var dataArray = new Array();

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};

//================================================================================
// Startup functions
//================================================================================

function pageReady() { //Runs when page finished loading html
  uuid = createUUID();

  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
  serverConnection.onmessage = gotMessageFromServer;

  var btn = document.getElementById("start");
  btn.disabled = false;
  var btn = document.getElementById("sendButton");
  btn.disabled = true;
}

function start(isCaller) { //Runs when button is clicked or remote connection is detected.
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;

  peerConnection.ondatachannel = receiveDataChannel;

  var btn = document.getElementById("start");
  btn.disabled = true;

  if(isCaller) {
    var header = document.getElementById("header")
      .innerHTML = "Connected as host! Ready to send data...";

    peerConnection.createOffer()
    .then(createdDescription)
    .catch(errorHandler);

    console.log('Fetching image from server.');
    var image = "XDF.png";
    
    var reqInit = {
      method: 'GET'
    };

    var request = new Request(image, reqInit);

    fetch(request)
    .then((response) => {
      return response.blob();
    })
    .then((blob) => {
      img = new Image();
      img.src = URL.createObjectURL(blob);
      document.body.appendChild(img);

      data = blob;

      console.log('img', img);
      console.log('data', data);
    })
    .catch((error) => {
      console.log('Fetch error', error);
    });

    dataChannel = peerConnection.createDataChannel('image');
    console.log('Data channel created: ', dataChannel);
    dataChannel.onopen = dataChannelOpen;
    dataChannel.onclose = function(){console.log("dataChannel closed.");}
  }
  else{
    var header = document.getElementById("header")
      .innerHTML = "Connected to host! Awaiting data...";
  }
}

//================================================================================
// Connection establishment
//================================================================================

function gotMessageFromServer(message) {
  if(!peerConnection){ //Not initiator.
    start(false);
  }

  var signal = JSON.parse(message.data);

  if(signal.uuid == uuid) return; // Ignore messages from ourself

  console.log('Message:', message);

  if(signal.sdp) {
    console.log('Set remote description.');
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
    .then(function(){
      if(signal.sdp.type == 'offer'){ // Only create answers in response to offers
        peerConnection.createAnswer()
        .then(createdDescription)
        .catch(errorHandler);
      }
    }).catch(errorHandler);
  }
  else if(signal.ice) {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice))
    .catch(errorHandler);
  }
}

function gotIceCandidate(event) {
  console.log("Got ICE candidate:", event);
  if(event.candidate != null) {
    serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
  }
}

function createdDescription(description) {
  console.log('Set local description');

  peerConnection.setLocalDescription(description)
  .then(function(){
    serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
  }).catch(errorHandler);
}

function errorHandler(error) {
  console.log(error);
}

//================================================================================
// Data channel
//================================================================================

function dataChannelOpen(){ //Data channel open, send data.
  console.log("dataChannel open.");
  console.log('dataSize', data.size);
  console.log('Connection', peerConnection.remoteDescription);

peerConnection.getStats().then((stats => {console.log(stats)}));

  var btn = document.getElementById("sendButton");
  btn.disabled = false;
}

function receiveDataChannel(event){ //Create receiver side data channel
  var btn = document.getElementById("start");
  btn.disabled = true;

  rDataChannel = event.channel;
  console.log("rDataChannel created.", rDataChannel);
  rDataChannel.onmessage = rMessage;
  rDataChannel.onopen = function(){console.log("rDataChannel open.");}
  rDataChannel.onclose = function(){console.log("rDataChannel closed.");}
}

function rMessage(event){ //Receiver got message
  console.log('Got rMessage.', event.data);

  dataArray.push(event.data);
  var blob = new Blob(dataArray);

  if(!img)
    img = new Image();
  img.src = URL.createObjectURL(blob);
  document.body.appendChild(img);
  console.log("Received data size: ", blob.size);

  var header = document.getElementById("header")
    .innerHTML = "Received data!";
}

function sendData(){
  console.log('Sending data.')

  if(data.size >= maxDataSize){
    console.log("Sending multipart");
    for(i = 0; i <= data.size/maxDataSize; i++){
      var dataSlice = data.slice(i*maxDataSize, (i+1)*maxDataSize);
      console.log('sliceSize', dataSlice.size);
      dataChannel.send(dataSlice);
    }
  }
  else
    dataChannel.send(data);

  var header = document.getElementById("header")
    .innerHTML = "Data sent!";
}

//================================================================================
// Misc
//================================================================================

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
