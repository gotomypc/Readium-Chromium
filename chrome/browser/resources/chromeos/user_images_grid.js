// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('options', function() {
  /** @const */ var ArrayDataModel = cr.ui.ArrayDataModel;
  /** @const */ var Grid = cr.ui.Grid;
  /** @const */ var GridItem = cr.ui.GridItem;
  /** @const */ var GridSelectionController = cr.ui.GridSelectionController;
  /** @const */ var ListSingleSelectionModel = cr.ui.ListSingleSelectionModel;

  /**
   * Interval between consecutive camera presence checks in msec while camera is
   * not present.
   * @const
   */
  var CAMERA_CHECK_INTERVAL_MS = 3000;

  /**
   * Interval between consecutive camera liveness checks in msec.
   * @const
   */
  var CAMERA_LIVENESS_CHECK_MS = 3000;

  /**
   * Number of frames recorded by takeVideo().
   * @const
   */
  var RECORD_FRAMES = 48;

  /**
   * FPS at which camera stream is recorded.
   * @const
   */
  var RECORD_FPS = 16;

   /**
    * Dimensions for camera capture.
    * @const
    */
  var CAPTURE_SIZE = {
    height: 480,
    width: 480
  };

  /**
   * Creates a new user images grid item.
   * @param {{url: string, title: string=, decorateFn: function=,
   *     clickHandler: function=}} imageInfo User image URL, optional title,
   *     decorator callback and click handler.
   * @constructor
   * @extends {cr.ui.GridItem}
   */
  function UserImagesGridItem(imageInfo) {
    var el = new GridItem(imageInfo);
    el.__proto__ = UserImagesGridItem.prototype;
    return el;
  }

  UserImagesGridItem.prototype = {
    __proto__: GridItem.prototype,

    /** @inheritDoc */
    decorate: function() {
      GridItem.prototype.decorate.call(this);
      var imageEl = cr.doc.createElement('img');
      var scheme = 'chrome://';
      if (this.dataItem.url.slice(0, scheme.length) == scheme)
        imageEl.src = this.dataItem.url + '@' + window.devicePixelRatio + 'x';
      else
        imageEl.src = this.dataItem.url;
      imageEl.title = this.dataItem.title || '';
      if (typeof this.dataItem.clickHandler == 'function')
        imageEl.addEventListener('mousedown', this.dataItem.clickHandler);
      // Remove any garbage added by GridItem and ListItem decorators.
      this.textContent = '';
      this.appendChild(imageEl);
      if (typeof this.dataItem.decorateFn == 'function')
        this.dataItem.decorateFn(this);
      this.setAttribute('role', 'option');
    }
  };

  /**
   * Creates a selection controller that wraps selection on grid ends
   * and translates Enter presses into 'activate' events.
   * @param {cr.ui.ListSelectionModel} selectionModel The selection model to
   *     interact with.
   * @param {cr.ui.Grid} grid The grid to interact with.
   * @constructor
   * @extends {cr.ui.GridSelectionController}
   */
  function UserImagesGridSelectionController(selectionModel, grid) {
    GridSelectionController.call(this, selectionModel, grid);
  }

  UserImagesGridSelectionController.prototype = {
    __proto__: GridSelectionController.prototype,

    /** @inheritDoc */
    getIndexBefore: function(index) {
      var result =
          GridSelectionController.prototype.getIndexBefore.call(this, index);
      return result == -1 ? this.getLastIndex() : result;
    },

    /** @inheritDoc */
    getIndexAfter: function(index) {
      var result =
          GridSelectionController.prototype.getIndexAfter.call(this, index);
      return result == -1 ? this.getFirstIndex() : result;
    },

    /** @inheritDoc */
    handleKeyDown: function(e) {
      if (e.keyIdentifier == 'Enter')
        cr.dispatchSimpleEvent(this.grid_, 'activate');
      else
        GridSelectionController.prototype.handleKeyDown.call(this, e);
    }
  };

  /**
   * Creates a new user images grid element.
   * @param {Object=} opt_propertyBag Optional properties.
   * @constructor
   * @extends {cr.ui.Grid}
   */
  var UserImagesGrid = cr.ui.define('grid');

  UserImagesGrid.prototype = {
    __proto__: Grid.prototype,

    /** @inheritDoc */
    createSelectionController: function(sm) {
      return new UserImagesGridSelectionController(sm, this);
    },

    /** @inheritDoc */
    decorate: function() {
      Grid.prototype.decorate.call(this);
      this.dataModel = new ArrayDataModel([]);
      this.itemConstructor = UserImagesGridItem;
      this.selectionModel = new ListSingleSelectionModel();
      this.inProgramSelection_ = false;
      this.addEventListener('dblclick', this.handleDblClick_.bind(this));
      this.addEventListener('change', this.handleChange_.bind(this));
      this.setAttribute('role', 'listbox');
      this.autoExpands = true;
    },

    /**
     * Handles double click on the image grid.
     * @param {Event} e Double click Event.
     * @private
     */
    handleDblClick_: function(e) {
      // If a child element is double-clicked and not the grid itself, handle
      // this as 'Enter' keypress.
      if (e.target != this)
        cr.dispatchSimpleEvent(this, 'activate');
    },

    /**
     * Handles selection change.
     * @param {Event} e Double click Event.
     * @private
     */
    handleChange_: function(e) {
      if (this.selectedItem === null)
        return;

      var oldSelectionType = this.selectionType;

      // Update current selection type.
      this.selectionType = this.selectedItem.type;

      // Show grey silhouette with the same border as stock images.
      if (/^chrome:\/\/theme\//.test(this.selectedItemUrl))
        this.previewElement.classList.add('default-image');

      this.updatePreview_();

      var e = new cr.Event('select', false, false);
      e.oldSelectionType = oldSelectionType;
      this.dispatchEvent(e);
    },

    /**
     * Updates the preview image, if present.
     * @private
     */
    updatePreview_: function() {
      var url = this.selectedItemUrl;
      if (url && this.previewImage_)
        this.previewImage_.src = url;
    },

    /**
     * Whether a camera is present or not.
     * @type {boolean}
     */
    get cameraPresent() {
      return this.cameraPresent_;
    },
    set cameraPresent(value) {
      this.cameraPresent_ = value;
      if (this.cameraLive)
        this.cameraImage = null;
    },

    /**
     * Whether camera is actually streaming video. May be |false| even when
     * camera is present and shown but still initializing.
     * @type {boolean}
     */
    get cameraOnline() {
      return this.previewElement.classList.contains('online');
    },
    set cameraOnline(value) {
      this.previewElement.classList[value ? 'add' : 'remove']('online');
      if (value) {
        this.cameraLiveCheckTimer_ = setInterval(
            this.checkCameraLive_.bind(this), CAMERA_LIVENESS_CHECK_MS);
      } else if (this.cameraLiveCheckTimer_) {
        clearInterval(this.cameraLiveCheckTimer_);
        this.cameraLiveCheckTimer_ = null;
      }
    },

    /**
     * Start camera presence check.
     * @param {function(): boolean} onAvailable Callback that is called if
     *     camera is available. If it returns |true|, capture is started
     *     immediately.
     * @param {function(): boolean} onAbsent Callback that is called if camera
     *     is absent. If it returns |true|, camera is checked again after some
     *     delay.
     */
    checkCameraPresence: function(onAvailable, onAbsent) {
      this.cameraOnline = false;
      if (this.cameraPresentCheckTimer_) {
        clearTimeout(this.cameraPresentCheckTimer_);
        this.cameraPresentCheckTimer_ = null;
      }
      if (!this.cameraVideo_)
        return;
      this.cameraCheckInProgress_ = true;
      navigator.webkitGetUserMedia(
          {video: true},
          this.handleCameraAvailable_.bind(this, onAvailable),
          // Needs both arguments since it may call checkCameraPresence again.
          this.handleCameraAbsent_.bind(this, onAvailable, onAbsent));
    },

    /**
     * Stops camera capture, if it's currently active.
     */
    stopCamera: function() {
      this.cameraOnline = false;
      if (this.cameraVideo_)
        this.cameraVideo_.src = '';
      // Cancel any pending getUserMedia() checks.
      this.cameraCheckInProgress_ = false;
    },

    /**
     * Handles successful camera check.
     * @param {function(): boolean} onAvailable Callback to call. If it returns
     *     |true|, capture is started immediately.
     * @param {MediaStream} stream Stream object as returned by getUserMedia.
     * @private
     */
    handleCameraAvailable_: function(onAvailable, stream) {
      this.cameraPresent = true;
      if (this.cameraCheckInProgress_ && onAvailable())
        this.cameraVideo_.src = window.webkitURL.createObjectURL(stream);
      this.cameraCheckInProgress_ = false;
    },

    /**
     * Handles camera check failure.
     * @param {function(): boolean} onAvailable Callback that is called if
     *     camera is available in future re-checks. If it returns |true|,
     *     capture is started immediately.
     * @param {function(): boolean} onAbsent Callback to call. If it returns
     *     |true|, camera is checked again after some delay.
     * @param {NavigatorUserMediaError=} err Error object.
     * @private
     */
    handleCameraAbsent_: function(onAvailable, onAbsent, err) {
      this.cameraPresent = false;
      this.cameraOnline = false;
      if (onAbsent()) {
        // Repeat the check.
        this.cameraPresentCheckTimer_ = setTimeout(
            this.checkCameraPresence.bind(this, onAvailable, onAbsent),
            CAMERA_CHECK_INTERVAL_MS);
      }
      this.cameraCheckInProgress_ = false;
    },

    /**
     * Handles successful camera capture start.
     * @private
     */
    handleVideoStarted_: function() {
      this.cameraOnline = true;
      this.handleVideoUpdate_();
    },

    /**
     * Handles camera stream update. Called regularly (at rate no greater then
     * 4/sec) while camera stream is live.
     * @private
     */
    handleVideoUpdate_: function() {
      this.lastFrameTime_ = new Date().getTime();
    },

    /**
     * Checks if camera is still live by comparing the timestamp of the last
     * 'timeupdate' event with the current time.
     * @private
     */
    checkCameraLive_: function() {
      if (new Date().getTime() - this.lastFrameTime_ >
          CAMERA_LIVENESS_CHECK_MS) {
        // Continue checking for camera presence but don't start capture.
        this.handleCameraAbsent_(function() { return false; },
                                 function() { return true; });
      }
    },

    /**
     * Type of the selected image (one of 'default', 'profile', 'camera').
     * Setting it will update class list of |previewElement|.
     * @type {string}
     */
    get selectionType() {
      return this.selectionType_;
    },
    set selectionType(value) {
      this.selectionType_ = value;
      var previewClassList = this.previewElement.classList;
      previewClassList[value == 'default' ? 'add' : 'remove']('default-image');
      previewClassList[value == 'profile' ? 'add' : 'remove']('profile-image');
      previewClassList[value == 'camera' ? 'add' : 'remove']('camera');
    },

    /**
     * Current image captured from camera as data URL. Setting to null will
     * return to the live camera stream.
     * @type {string=}
     */
    get cameraImage() {
      return this.cameraImage_;
    },
    set cameraImage(imageUrl) {
      this.cameraLive = !imageUrl;
      if (this.cameraPresent && !imageUrl)
        imageUrl = UserImagesGrid.ButtonImages.TAKE_PHOTO;
      if (imageUrl) {
        this.cameraImage_ = this.cameraImage_ ?
            this.updateItem(this.cameraImage_, imageUrl) :
            this.addItem(imageUrl, this.cameraTitle_, undefined, 0);
        this.cameraImage_.type = 'camera';
      } else {
        this.removeItem(this.cameraImage_);
        this.cameraImage_ = null;
      }

      // Set focus to the grid, unless focus is on the OK button.
      if (!document.activeElement || document.activeElement.tagName != 'BUTTON')
        this.focus();
    },

    /**
     * Title for the camera element. Must be set before setting |cameraImage|
     * for the first time.
     * @type {string}
     */
    set cameraTitle(value) {
      return this.cameraTitle_ = value;
    },

    /**
     * True when camera is in live mode (i.e. no still photo selected).
     * @type {boolean}
     */
    get cameraLive() {
      return this.cameraLive_;
    },
    set cameraLive(value) {
      this.cameraLive_ = value;
      this.previewElement.classList[value ? 'add' : 'remove']('live');
    },

    /**
     * Should only be queried from the 'change' event listener, true if the
     * change event was triggered by a programmatical selection change.
     * @type {boolean}
     */
    get inProgramSelection() {
      return this.inProgramSelection_;
    },

    /**
     * URL of the image selected.
     * @type {string?}
     */
    get selectedItemUrl() {
      var selectedItem = this.selectedItem;
      return selectedItem ? selectedItem.url : null;
    },
    set selectedItemUrl(url) {
      for (var i = 0, el; el = this.dataModel.item(i); i++) {
        if (el.url === url)
          this.selectedItemIndex = i;
      }
    },

    /**
     * Set index to the image selected.
     * @type {number} index The index of selected image.
     */
    set selectedItemIndex(index) {
      this.inProgramSelection_ = true;
      this.selectionModel.selectedIndex = index;
      this.inProgramSelection_ = false;
    },

    /** @inheritDoc */
    get selectedItem() {
      var index = this.selectionModel.selectedIndex;
      return index != -1 ? this.dataModel.item(index) : null;
    },
    set selectedItem(selectedItem) {
      var index = this.indexOf(selectedItem);
      this.inProgramSelection_ = true;
      this.selectionModel.selectedIndex = index;
      this.selectionModel.leadIndex = index;
      this.inProgramSelection_ = false;
    },

    /**
     * Element containing the preview image (the first IMG element) and the
     * camera live stream (the first VIDEO element).
     * @type {HTMLElement}
     */
    get previewElement() {
      // TODO(ivankr): temporary hack for non-HTML5 version.
      return this.previewElement_ || this;
    },
    set previewElement(value) {
      this.previewElement_ = value;
      this.previewImage_ = value.querySelector('img');
      this.cameraVideo_ = value.querySelector('video');
      this.cameraVideo_.addEventListener('canplay',
                                         this.handleVideoStarted_.bind(this));
      this.cameraVideo_.addEventListener('timeupdate',
                                         this.handleVideoUpdate_.bind(this));
      this.updatePreview_();
      this.checkCameraPresence(
          function() {
            return false;  // Don't start streaming if camera is present.
          },
          function() {
            return false;  // Don't retry if camera is absent.
          });
    },

    /**
     * Whether the camera live stream and photo should be flipped horizontally.
     * @type {boolean}
     */
    get flipPhoto() {
      return this.flipPhoto_ || false;
    },
    set flipPhoto(value) {
      this.flipPhoto_ = value;
      this.previewElement.classList[value ? 'add' : 'remove']('flip-x');
    },

    /**
     * Performs photo capture from the live camera stream.
     * @param {function=} opt_callback Callback that receives taken photo as
     *     data URL.
     * @return {boolean} Whether photo capture was successful.
     */
    takePhoto: function(opt_callback) {
      if (!this.cameraOnline)
        return false;
      var canvas = document.createElement('canvas');
      canvas.width = CAPTURE_SIZE.width;
      canvas.height = CAPTURE_SIZE.height;
      this.captureFrame_(
          this.cameraVideo_, canvas.getContext('2d'), CAPTURE_SIZE);
      var photoURL = canvas.toDataURL('image/png');
      if (opt_callback && typeof opt_callback == 'function')
        opt_callback(photoURL);
      // Wait until image is loaded before displaying it.
      var self = this;
      var previewImg = new Image();
      previewImg.addEventListener('load', function(e) {
        self.cameraImage = this.src;
      });
      previewImg.src = photoURL;
      return true;
    },

    /**
     * Performs video capture from the live camera stream.
     * @param {function=} opt_callback Callback that receives taken video as
     *     data URL of a vertically stacked PNG sprite.
     */
    takeVideo: function(opt_callback) {
      var canvas = document.createElement('canvas');
      canvas.width = CAPTURE_SIZE.width;
      canvas.height = CAPTURE_SIZE.height * RECORD_FRAMES;
      var ctx = canvas.getContext('2d');
      // Force canvas initialization to prevent FPS lag on the first frame.
      ctx.fillRect(0, 0, 1, 1);
      var captureData = {
        callback: opt_callback,
        canvas: canvas,
        ctx: ctx,
        frameNo: 0,
        lastTimestamp: new Date().getTime()
      };
      captureData.timer = setInterval(
          this.captureVideoFrame_.bind(this, captureData), 1000 / RECORD_FPS);
    },

    /**
     * Discard current photo and return to the live camera stream.
     */
    discardPhoto: function() {
      this.cameraImage = null;
    },

    /**
     * Capture a single still frame from a <video> element, placing it at the
     * current drawing origin of a canvas context.
     * @param {HTMLVideoElement} video Video element to capture from.
     * @param {CanvasRenderingContext2D} ctx Canvas context to draw onto.
     * @param {{width: number, height: number}} destSize Capture size.
     * @private
     */
    captureFrame_: function(video, ctx, destSize) {
      var width = video.videoWidth;
      var height = video.videoHeight;
      if (width < destSize.width || height < destSize.height) {
        console.error('Video capture size too small: ' +
                      width + 'x' + height + '!');
      }
      var src = {};
      if (width / destSize.width > height / destSize.height) {
        // Full height, crop left/right.
        src.height = height;
        src.width = height * destSize.width / destSize.height;
      } else {
        // Full width, crop top/bottom.
        src.width = width;
        src.height = width * destSize.height / destSize.width;
      }
      src.x = (width - src.width) / 2;
      src.y = (height - src.height) / 2;
      if (this.flipPhoto) {
        ctx.save();
        ctx.translate(destSize.width, 0);
        ctx.scale(-1.0, 1.0);
      }
      ctx.drawImage(video, src.x, src.y, src.width, src.height,
                    0, 0, destSize.width, destSize.height);
      if (this.flipPhoto)
        ctx.restore();
    },

    /**
     * Capture next frame of the video being recorded after a takeVideo() call.
     * @param {Object} data Property bag with the recorder details.
     * @private
     */
    captureVideoFrame_: function(data) {
      var lastTimestamp = new Date().getTime();
      var delayMs = lastTimestamp - data.lastTimestamp;
      console.error('Delay: ' + delayMs + ' (' + (1000 / delayMs + ' FPS)'));
      data.lastTimestamp = lastTimestamp;

      this.captureFrame_(this.cameraVideo_, data.ctx, CAPTURE_SIZE);
      data.ctx.translate(0, CAPTURE_SIZE.height);

      if (++data.frameNo == RECORD_FRAMES) {
        clearTimeout(data.timer);
        if (data.callback && typeof data.callback == 'function')
          data.callback(data.canvas.toDataURL('image/png'));
      }
    },

    /**
     * Adds new image to the user image grid.
     * @param {string} src Image URL.
     * @param {string=} opt_title Image tooltip.
     * @param {function=} opt_clickHandler Image click handler.
     * @param {number=} opt_position If given, inserts new image into
     *     that position (0-based) in image list.
     * @param {function=} opt_decorateFn Function called with the list element
     *     as argument to do any final decoration.
     * @return {!Object} Image data inserted into the data model.
     */
    // TODO(ivankr): this function needs some argument list refactoring.
    addItem: function(url, opt_title, opt_clickHandler, opt_position,
                      opt_decorateFn) {
      var imageInfo = {
        url: url,
        title: opt_title,
        clickHandler: opt_clickHandler,
        decorateFn: opt_decorateFn
      };
      this.inProgramSelection_ = true;
      if (opt_position !== undefined)
        this.dataModel.splice(opt_position, 0, imageInfo);
      else
        this.dataModel.push(imageInfo);
      this.inProgramSelection_ = false;
      return imageInfo;
    },

    /**
     * Returns index of an image in grid.
     * @param {Object} imageInfo Image data returned from addItem() call.
     * @return {number} Image index (0-based) or -1 if image was not found.
     */
    indexOf: function(imageInfo) {
      return this.dataModel.indexOf(imageInfo);
    },

    /**
     * Replaces an image in the grid.
     * @param {Object} imageInfo Image data returned from addItem() call.
     * @param {string} imageUrl New image URL.
     * @param {string=} opt_title New image tooltip (if undefined, tooltip
     *     is left unchanged).
     * @return {!Object} Image data of the added or updated image.
     */
    updateItem: function(imageInfo, imageUrl, opt_title) {
      var imageIndex = this.indexOf(imageInfo);
      var wasSelected = this.selectionModel.selectedIndex == imageIndex;
      this.removeItem(imageInfo);
      var newInfo = this.addItem(
          imageUrl,
          opt_title === undefined ? imageInfo.title : opt_title,
          imageInfo.clickHandler,
          imageIndex,
          imageInfo.decorateFn);
      // Update image data with the reset of the keys from the old data.
      for (k in imageInfo) {
        if (!(k in newInfo))
          newInfo[k] = imageInfo[k];
      }
      if (wasSelected)
        this.selectedItem = newInfo;
      return newInfo;
    },

    /**
     * Removes previously added image from the grid.
     * @param {Object} imageInfo Image data returned from the addItem() call.
     */
    removeItem: function(imageInfo) {
      var index = this.indexOf(imageInfo);
      if (index != -1) {
        var wasSelected = this.selectionModel.selectedIndex == index;
        this.inProgramSelection_ = true;
        this.dataModel.splice(index, 1);
        if (wasSelected) {
          // If item removed was selected, select the item next to it.
          this.selectedItem = this.dataModel.item(
              Math.min(this.dataModel.length - 1, index));
        }
        this.inProgramSelection_ = false;
      }
    },

    /**
     * Forces re-display, size re-calculation and focuses grid.
     */
    updateAndFocus: function() {
      // Recalculate the measured item size.
      this.measured_ = null;
      this.columns = 0;
      this.redraw();
      this.focus();
    }
  };

  /**
   * URLs of special button images.
   * @enum {string}
   */
  UserImagesGrid.ButtonImages = {
    TAKE_PHOTO: 'chrome://theme/IDR_BUTTON_USER_IMAGE_TAKE_PHOTO',
    CHOOSE_FILE: 'chrome://theme/IDR_BUTTON_USER_IMAGE_CHOOSE_FILE',
    PROFILE_PICTURE: 'chrome://theme/IDR_PROFILE_PICTURE_LOADING'
  };

  return {
    UserImagesGrid: UserImagesGrid
  };
});
