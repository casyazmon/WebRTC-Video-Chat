
var name;
var stream;
var connectedUser;
var conn = new WebSocket('wss://10.42.0.1:8443');

conn.onopen = function () {
	console.log("Connected to the signaling server");
	
};

//when we got a message from a signaling server
conn.onmessage = function (msg) {
	console.log("Got message", msg.data);
	var data = JSON.parse(msg.data);
	switch(data.type) {
		case "login":
			handleLogin(data.success);
			break;
		//when somebody wants to call us
		case "offer":
			handleOffer(data.offer, data.name);
			break;
		case "answer":
			handleAnswer(data.answer);
			break;
		//when a remote peer sends an ice candidate to us
		case "candidate":
			handleCandidate(data.candidate);
			break;
		case "leave":
			handleLeave();
			break;
		case "userlist":
			var ul = "";
			for (var i = 0; i < data.user.length; i++) {
				ul += data.user[i]
			}
			document.getElementById("userlistbox").innerHTML = ul;
		default:
			break;
	}
};

conn.onerror = function (err) {
	console.log("Got error", err);
};

//alias for sending JSON encoded messages
function send(message) {
	//attach the other peer username to our messages
	if (connectedUser) {
		message.name = connectedUser;
	}
	conn.send(JSON.stringify(message));
};

//******
//UI selectors block
//******
var audiomode = document.querySelector('#audiomode');
var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');
var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');
var hangUpBtn = document.querySelector('#hangUpBtn');
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var yourConn;
var stream;
callPage.style.display = "none";
// Login when the user clicks the button
loginBtn.addEventListener("click", function (event) {
	name = usernameInput.value;
	if (name.length > 0) {
		send({
			type: "login",
			name: name
		});
	}
});

// constraints for desktop browser 
var desktopConstraints = {
	video: {
		mandatory: {
			maxWidth: 800, 
			maxHeight: 600
		}
	},
	audio:true
};
//constraints for mobile browser 
var mobileConstraints = {
	video: {
		mandatory: {
			maxWidth: 480,
			maxHeight: 320,
		}
	},
	audio: true
};
 
//if a user is using a mobile browser 
if(/Android|iPhone|iPad/i.test(navigator.userAgent)){
	var constraints = mobileConstraints;
} else {
	var constraints = desktopConstraints;
}

function hasUserMedia() {
	navigator.getUserMedia = navigator.getUserMedia || 
	navigator.webkitGetUserMedia || navigator.mozGetUserMedia || 
	navigator.msGetUserMedia;

	return !!navigator.getUserMedia;

}


function handleLogin(success) {
	if (success === false) {
		alert("Ooops...try a different username");
	} else if(hasUserMedia) {
		navigator.getUserMedia = navigator.getUserMedia || 
		navigator.webkitGetUserMedia || navigator.mozGetUserMedia || 
		navigator.msGetUserMedia;
		loginPage.style.display = "none";
		callPage.style.display = "block";
		//**********************
		//Starting a peer connection
		//**********************
		//getting local video stream
		navigator.getUserMedia({ video: true, audio: true }, function
		(myStream) {
			stream = myStream;
			//displaying local video stream on the page
			localVideo.src = window.URL.createObjectURL(stream);
			//using Google public stun server
			var configuration = {
				"iceServers": [{ "url": "stun:stun2.1.google.com:19302" }]
			};
			yourConn = new RTCPeerConnection(configuration);
			// setup stream listening
			yourConn.addStream(stream);
			//when a remote user adds stream to the peer connection, we display it
			yourConn.onaddstream = function (e) {
				remoteVideo.src = window.URL.createObjectURL(e.stream);
			};
			// Setup ice handling
			yourConn.onicecandidate = function (event) {
				if (event.candidate) {
					send({
						type: "candidate",
						candidate: event.candidate
					});
				}
			};
		}, function (error) {
		console.log(error);
		});
	}
};

//  removing audio track
audiomode.addEventListener("click", function(){
	
	var audioTrack = stream.getAudioTracks();
	if(audioTrack.length > 0){
		stream.removeTrack(audioTrack[0]);
		console.log("audioTrack removed");
	}
});

//initiating a call
callBtn.addEventListener("click", function () {
	var callToUsername = callToUsernameInput.value;
	if (callToUsername.length > 0) {
		connectedUser = callToUsername;
		// create an offer
		yourConn.createOffer(function (offer) {
			send({
				type: "offer",
				offer: offer
			});
			yourConn.setLocalDescription(offer);
		}, function (error) {
		alert("Error when creating an offer");
		});
	}
});

//when somebody sends us an offer
function handleOffer(offer, name) {
	connectedUser = name;
	yourConn.setRemoteDescription(new RTCSessionDescription(offer));
	//create an answer to an offer
	yourConn.createAnswer(function (answer) {
		yourConn.setLocalDescription(answer);
		send({
		type: "answer",
		answer: answer
		});
	}, function (error) {
		alert("Error when creating an answer");
	});
};

//when we got an answer from a remote user
function handleAnswer(answer) {
	yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};
//when we got an ice candidate from a remote user
function handleCandidate(candidate) {
	yourConn.addIceCandidate(new RTCIceCandidate(candidate));
};
//hang up
hangUpBtn.addEventListener("click", function () {
	send({
	type: "leave"
	});
	handleLeave();
});
function handleLeave() {
	/*myStream.getTracks().forEach(function(track) {
    track.stop();
  });*/
	hangUpBtn.disabled = true;
	callBtn.disabled=false;
	connectedUser = null;
	remoteVideo.src = null;
	/*localVideo.src=null;*/
	yourConn.close();
	yourConn.onicecandidate = null;
	yourConn.onaddstream = null;
};