const { app, BrowserWindow } = require('electron');
const express = require('express');
const path = require('path');
const server = require('./backend/server.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Aguarda 1 segundo para o servidor Express iniciar
    setTimeout(() => {
        win.loadURL('http://localhost:3000');
    }, 1000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});