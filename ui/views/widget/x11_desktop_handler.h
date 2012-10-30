// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef UI_VIEWS_WIDGET_X11_DESKTOP_HANDLER_H_
#define UI_VIEWS_WIDGET_X11_DESKTOP_HANDLER_H_

#include <X11/Xlib.h>
// Get rid of a macro from Xlib.h that conflicts with Aura's RootWindow class.
#undef RootWindow

#include "base/message_loop.h"
#include "ui/aura/env_observer.h"
#include "ui/base/x/x11_atom_cache.h"
#include "ui/views/views_export.h"

template <typename T> struct DefaultSingletonTraits;

namespace aura {
class FocusManager;
class DesktopActivationClient;
}

namespace views {

// A singleton that owns global objects related to the desktop and listens for
// X11 events on the X11 root window. Destroys itself when aura::Env is
// deleted.
class VIEWS_EXPORT X11DesktopHandler
    : public MessageLoop::Dispatcher,
      public aura::EnvObserver {
 public:
  // Returns the singleton handler.
  static X11DesktopHandler* get();

  aura::FocusManager* get_focus_manager() const {
    return focus_manager_.get();
  }
  aura::DesktopActivationClient* get_activation_client() const {
    return desktop_activation_client_.get();
  }

  // Overridden from MessageLoop::Dispatcher:
  virtual bool Dispatch(const base::NativeEvent& event) OVERRIDE;

  // Overridden from aura::EnvObserver:
  virtual void OnWindowInitialized(aura::Window* window) OVERRIDE;
  virtual void OnWillDestroyEnv() OVERRIDE;

 private:
  explicit X11DesktopHandler();
  virtual ~X11DesktopHandler();

  // Handles changes in activation.
  void OnActiveWindowChanged(::Window window);

  // The display and the native X window hosting the root window.
  Display* xdisplay_;

  // The native root window.
  ::Window x_root_window_;

  ui::X11AtomCache atom_cache_;

  // Global focus/activation managers.
  scoped_ptr<aura::FocusManager> focus_manager_;
  scoped_ptr<aura::DesktopActivationClient> desktop_activation_client_;

  DISALLOW_COPY_AND_ASSIGN(X11DesktopHandler);
};

}  // namespace views

#endif  // UI_VIEWS_WIDGET_X11_DESKTOP_HANDLER_H_