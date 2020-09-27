/**
 * @author Aman Dua <aman.dua1995@gmail.com>
 * @date 26th September, 2020
 */
import helpers from './helpers.js';

window.addEventListener( 'load', () => {
    const room = helpers.getQueryString( location.href, 'room' );
    if ( !room ) {
        document.querySelector( '#meeting-create' ).attributes.removeNamedItem( 'hidden' );
    }

    else {
        let commElem = document.getElementsByClassName( 'room-comm' );

        for ( let i = 0; i < commElem.length; i++ ) {
            commElem[i].attributes.removeNamedItem( 'hidden' );
        }

        var pc = [];

        let socket = io( '/stream' );

        var socketId = '';
        var myStream = '';
        var screen = '';


        //Get user video by default
        getAndSetUserStream();


        socket.on( 'connect', () => {
            //set socketId
            socketId = socket.io.engine.id;


            socket.emit( 'subscribe', {
                room: room,
                socketId: socketId
            } );


            socket.on( 'new user', ( data ) => {
                socket.emit( 'newUserStart', { to: data.socketId, sender: socketId } );
                pc.push( data.socketId );
                init( true, data.socketId );
            } );


            socket.on( 'newUserStart', ( data ) => {
                pc.push( data.sender );
                init( false, data.sender );
            } );


            socket.on( 'ice candidates', async ( data ) => {
                data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
            } );


            socket.on( 'sdp', async ( data ) => {
                if ( data.description.type === 'offer' ) {
                    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';

                    helpers.getUserFullMedia().then( async ( stream ) => {
                        if ( !document.getElementById( 'local' ).srcObject ) {
                            helpers.setLocalStream( stream );
                        }

                        //save my stream
                        myStream = stream;

                        stream.getTracks().forEach( ( track ) => {
                            pc[data.sender].addTrack( track, stream );
                        } );

                        let answer = await pc[data.sender].createAnswer();

                        await pc[data.sender].setLocalDescription( answer );

                        socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                }

                else if ( data.description.type === 'answer' ) {
                    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
                }
            } );
        } );


        function getAndSetUserStream() {
            helpers.getUserFullMedia().then( ( stream ) => {
                //save my stream
                myStream = stream;

                helpers.setLocalStream( stream );
            } ).catch( ( e ) => {
                console.error( `stream error: ${ e }` );
            } );
        }


        function init( createOffer, peer ) {
            pc[peer] = new RTCPeerConnection( helpers.getIceServer() );

            if ( screen && screen.getTracks().length ) {
                screen.getTracks().forEach( ( track ) => {
                    pc[peer].addTrack( track, screen );//should trigger negotiationneeded event
                } );
            }

            else if ( myStream ) {
                myStream.getTracks().forEach( ( track ) => {
                    pc[peer].addTrack( track, myStream );//should trigger negotiationneeded event
                } );
            }

            else {
                helpers.getUserFullMedia().then( ( stream ) => {
                    //save my stream
                    myStream = stream;

                    stream.getTracks().forEach( ( track ) => {
                        pc[peer].addTrack( track, stream );//should trigger negotiationneeded event
                    } );

                    helpers.setLocalStream( stream );
                } ).catch( ( e ) => {
                    console.error( `stream error: ${ e }` );
                } );
            }



            //create offer
            if ( createOffer ) {
                pc[peer].onnegotiationneeded = async () => {
                    let offer = await pc[peer].createOffer();

                    await pc[peer].setLocalDescription( offer );

                    socket.emit( 'sdp', { description: pc[peer].localDescription, to: peer, sender: socketId } );
                };
            }



            //send ice candidate to peers
            pc[peer].onicecandidate = ( { candidate } ) => {
                socket.emit( 'ice candidates', { candidate: candidate, to: peer, sender: socketId } );
            };



            //add
            pc[peer].ontrack = ( e ) => {
                let str = e.streams[0];
                if ( document.getElementById( `${ peer }-video` ) ) {
                    document.getElementById( `${ peer }-video` ).srcObject = str;
                }

                else {
                    //video elem
                    let newVid = document.createElement( 'video' );
                    newVid.id = `${ peer }-video`;
                    newVid.srcObject = str;
                    newVid.autoplay = true;
                    newVid.className = 'remote-video';

                    //create a new div for card
                    let cardDiv = document.createElement( 'div' );
                    cardDiv.className = 'card card-sm';
                    cardDiv.id = peer;
                    cardDiv.appendChild( newVid );

                    //put div in main-section elem
                    document.getElementById( 'videos' ).appendChild( cardDiv );

                    helpers.adjustVideoElemSize();
                }
            };



            pc[peer].onconnectionstatechange = ( d ) => {
                switch ( pc[peer].iceConnectionState ) {
                    case 'disconnected':
                    case 'failed':
                        helpers.closeVideo( peer );
                        break;

                    case 'closed':
                        helpers.closeVideo( peer );
                        break;
                }
            };



            pc[peer].onsignalingstatechange = ( d ) => {
                switch ( pc[peer].signalingState ) {
                    case 'closed':
                        console.log( "Signalling state is 'closed'" );
                        helpers.closeVideo( peer );
                        break;
                }
            };
        }


        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            helpers.setLocalStream( stream, mirrorMode );

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for ( let p in pc ) {
                let pName = pc[p];

                if ( typeof pc[pName] == 'object' ) {
                    helpers.replaceTrack( track, pc[pName] );
                }
            }
        }


        //When the video icon is clicked
        document.getElementById( 'toggle-video' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            let elem = document.getElementById( 'toggle-video' );

            if ( myStream.getVideoTracks()[0].enabled ) {
                e.target.classList.remove( 'fa-video' );
                e.target.classList.add( 'fa-video-slash' );
                elem.setAttribute( 'title', 'Show Video' );

                myStream.getVideoTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove( 'fa-video-slash' );
                e.target.classList.add( 'fa-video' );
                elem.setAttribute( 'title', 'Hide Video' );

                myStream.getVideoTracks()[0].enabled = true;
            }

            broadcastNewTracks( myStream, 'video' );
        } );


        //When the mute icon is clicked
        document.getElementById( 'toggle-mute' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            let elem = document.getElementById( 'toggle-mute' );

            if ( myStream.getAudioTracks()[0].enabled ) {
                e.target.classList.remove( 'fa-microphone-alt' );
                e.target.classList.add( 'fa-microphone-alt-slash' );
                elem.setAttribute( 'title', 'Unmute' );

                myStream.getAudioTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove( 'fa-microphone-alt-slash' );
                e.target.classList.add( 'fa-microphone-alt' );
                elem.setAttribute( 'title', 'Mute' );

                myStream.getAudioTracks()[0].enabled = true;
            }

            broadcastNewTracks( myStream, 'audio' );
        } );

    }
} );
