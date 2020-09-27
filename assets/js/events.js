import helpers from './helpers.js';

window.addEventListener( 'load', () => {
    //When the video frame is clicked. This will enable picture-in-picture
    document.getElementById( 'local' ).addEventListener( 'click', () => {
        if ( !document.pictureInPictureElement ) {
            document.getElementById( 'local' ).requestPictureInPicture()
                .catch( error => {
                    // Video failed to enter Picture-in-Picture mode.
                    console.error( error );
                } );
        }

        else {
            document.exitPictureInPicture()
                .catch( error => {
                    // Video failed to leave Picture-in-Picture mode.
                    console.error( error );
                } );
        }
    } );


    document.getElementById( 'Host a Meeting' ).addEventListener( 'click', ( e ) => {
        e.preventDefault();

        
        // create meeting link
        let meetingLink = `${ location.origin }?room=${ helpers.generateRandomString(8) }`;
        
        //save the user's name in sessionStorage
        sessionStorage.setItem( 'meetingLink', meetingLink );
        
        // show message with link to meeting
        document.querySelector( '#meeting-created' ).innerHTML = `Meeting successfully created. Click <a href='${ meetingLink }'>here</a> to start the meeting. 
            Share the meeting link with your partners.`;
    } );


    document.addEventListener( 'click', ( e ) => {
        if ( e.target && e.target.classList.contains( 'expand-remote-video' ) ) {
            helpers.maximiseStream( e );
        }

        else if ( e.target && e.target.classList.contains( 'mute-remote-mic' ) ) {
            helpers.singleStreamToggleMute( e );
        }
    } );
} );
