//
// File: src/app/static/js/author_interactions.js
//
// Everything related to the "About Author" section, including the cat animations, stars, and GitHub/Discord/LinkedIn buttons
//

// 1) Round button and stars animation
var circleBtn = document.getElementById('circle-btn');
var stars1    = document.getElementById('stars');
var stars2    = document.getElementById('stars2');
var stars3    = document.getElementById('stars3');
var toggleState = false;

if (circleBtn) {
    circleBtn.addEventListener('click', function() {
        if (!toggleState) {
            if (stars1) stars1.style.display='none';
            if (stars2) stars2.style.display='none';
            if (stars3) stars3.style.display='none';
            circleBtn.style.setProperty('--emoji','"🥺"');
            toggleState=true;
        } else {
            if (stars1) stars1.style.display='block';
            if (stars2) stars2.style.display='block';
            if (stars3) stars3.style.display='block';
            circleBtn.style.setProperty('--emoji','"🥰"');
            toggleState=false;
        }
    });
}

// 2) Social buttons (GitHub, Discord, LinkedIn)
var ghBtn = document.querySelector('.light-button.github button.bt');
if (ghBtn) {
    ghBtn.addEventListener('click', () => {
        window.open('https://github.com/NikolayKatrosha','_blank');
    });
}
var discBtn = document.querySelector('.light-button.discord button.bt');
if (discBtn) {
    discBtn.addEventListener('click', () => {
        window.open('https://discordapp.com/users/639868429368557579','_blank');
    });
}
var liBtn = document.querySelector('.light-button.linkedin button.bt');
if (liBtn) {
    liBtn.addEventListener('click', () => {
        window.open('https://www.linkedin.com/in/nikolay-katrosha-4b8779221/','_blank');
    });
}

// 3) Cat animation: moving pupils according to mouse position
document.addEventListener('mousemove', function(e) {
    var cat = document.querySelector('.cat');
    if (!cat) return;
    var eyes = cat.querySelectorAll('.eye');
    eyes.forEach(eye => {
        var pupil = eye.querySelector('.eye-pupil');
        if (!pupil) return;

        var rect = eye.getBoundingClientRect();
        var centerX = rect.left + rect.width/2;
        var centerY = rect.top  + rect.height/2;
        var mouseX  = e.clientX;
        var mouseY  = e.clientY;

        var angle = Math.atan2(mouseY - centerY, mouseX - centerX);
        var maxX  = rect.width * 0.15;
        var maxY  = rect.height * 0.15;

        var offX = Math.cos(angle) * maxX;
        var offY = Math.sin(angle) * maxY;
        pupil.style.transform = `translate(${offX}px, ${offY}px)`;
    });
});
