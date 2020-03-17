var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var uuid;
var serverConnection;
var src;
var img = this;

var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};

function pageReady() {
  uuid = createUUID();

  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
  serverConnection.onmessage = gotMessageFromServer;

/*
  var constraints = {
    video: true,
    audio: true,
  };

  if(navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  } else {
    alert('Your browser does not support getUserMedia API');
  }
*/

}

/*
function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
}
*/

function start(isCaller) {
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
  //peerConnection.addStream(localStream);

  peerConnection.ondatachannel = receiveDataChannel;

  if(isCaller) {
    peerConnection.createOffer()
    .then(createdDescription)
    .catch(errorHandler);

    console.log('Fetching image from server.');
    src = "ubuntu-logo.png";
    img = document.createElement("img");
    img.src = src;
    img.width = 119;
    img.height = 99;
    img.alt = "Image!";
    document.body.appendChild(img);

console.log("img:", img);

    dataChannel = peerConnection.createDataChannel('image');
    console.log('Data channel created: ', dataChannel);
    dataChannel.onopen = dataChannelOpen;
    dataChannel.onclose = function(){console.log("dataChannel closed.");}
  }
}

function dataChannelOpen(){
  console.log("dataChannel open.");

let fruits = [66346, 123213]

  dataChannel.send(fruits);
}

function receiveDataChannel(event){
  rDataChannel = event.channel;
  console.log("rDataChannel created.", rDataChannel);
  rDataChannel.onmessage = rMessage;
  rDataChannel.onopen = function(){console.log("rDataChannel open.");}
  rDataChannel.onclose = function(){console.log("rDataChannel closed.");}
}

function rMessage(event){
  console.log('Got rMessage.', event.data);
  img = document.createElement("img");
  img.src = event.data;
  img.width = 119;
  img.height = 99;
  img.alt = "Image!";
  document.body.appendChild(img);

console.log(event.data[0]);
}

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

function gotRemoteStream(event) {
  console.log('got remote stream');
  remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
  console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
