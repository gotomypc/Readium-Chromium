// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "content/test/gpu/gpu_test_config.h"

#include "base/logging.h"
#include "base/sys_info.h"
#include "content/gpu/gpu_info_collector.h"
#include "content/public/common/gpu_info.h"

namespace {

GPUTestConfig::OS GetCurrentOS() {
#if defined(OS_CHROMEOS)
  return GPUTestConfig::kOsChromeOS;
#elif defined(OS_LINUX) || defined(OS_OPENBSD)
  return GPUTestConfig::kOsLinux;
#elif defined(OS_WIN)
  int32 major_version = 0;
  int32 minor_version = 0;
  int32 bugfix_version = 0;
  base::SysInfo::OperatingSystemVersionNumbers(
      &major_version, &minor_version, &bugfix_version);
  if (major_version == 5)
    return GPUTestConfig::kOsWinXP;
  if (major_version == 6 && minor_version == 0)
    return GPUTestConfig::kOsWinVista;
  if (major_version == 6 && minor_version == 1)
    return GPUTestConfig::kOsWin7;
#elif defined(OS_MACOSX)
  int32 major_version = 0;
  int32 minor_version = 0;
  int32 bugfix_version = 0;
  base::SysInfo::OperatingSystemVersionNumbers(
      &major_version, &minor_version, &bugfix_version);
  if (major_version == 10) {
    switch (minor_version) {
      case 5:
        return GPUTestConfig::kOsMacLeopard;
      case 6:
        return GPUTestConfig::kOsMacSnowLeopard;
      case 7:
        return GPUTestConfig::kOsMacLion;
    }
  }
#endif
  return GPUTestConfig::kOsUnknown;
}

}  // namespace anonymous

GPUTestConfig::GPUTestConfig()
    : os_(kOsUnknown),
      gpu_device_id_(0),
      build_type_(kBuildTypeUnknown) {
}

GPUTestConfig::~GPUTestConfig() {
}

void GPUTestConfig::set_os(int32 os) {
  DCHECK_EQ(0, os & ~(kOsWin | kOsMac | kOsLinux | kOsChromeOS));
  os_ = os;
}

void GPUTestConfig::AddGPUVendor(uint32 gpu_vendor) {
  DCHECK_NE(0u, gpu_vendor);
  for (size_t i = 0; i < gpu_vendor_.size(); ++i)
    DCHECK_NE(gpu_vendor_[i], gpu_vendor);
  gpu_vendor_.push_back(gpu_vendor);
}

void GPUTestConfig::set_gpu_device_id(uint32 id) {
  gpu_device_id_ = id;
}

void GPUTestConfig::set_build_type(int32 build_type) {
  DCHECK_EQ(0, build_type & ~(kBuildTypeRelease | kBuildTypeDebug));
  build_type_ = build_type;
}

bool GPUTestConfig::IsValid() const {
  if (gpu_device_id_ != 0 && (gpu_vendor_.size() != 1 || gpu_vendor_[0] == 0))
    return false;
  return true;
}

bool GPUTestConfig::OverlapsWith(const GPUTestConfig& config) const {
  DCHECK(IsValid());
  DCHECK(config.IsValid());
  if (config.os_ != kOsUnknown && os_ != kOsUnknown &&
      (os_ & config.os_) == 0)
    return false;
  if (config.gpu_vendor_.size() > 0 && gpu_vendor_.size() > 0) {
    bool shared = false;
    for (size_t i = 0; i < config.gpu_vendor_.size() && !shared; ++i) {
      for (size_t j = 0; j < gpu_vendor_.size(); ++j) {
        if (config.gpu_vendor_[i] == gpu_vendor_[j]) {
          shared = true;
          break;
        }
      }
    }
    if (!shared)
      return false;
  }
  if (config.gpu_device_id_ != 0 && gpu_device_id_ != 0 &&
      gpu_device_id_ != config.gpu_device_id_)
    return false;
  if (config.build_type_ != kBuildTypeUnknown &&
      build_type_ != kBuildTypeUnknown &&
      (build_type_ & config.build_type_) == 0)
    return false;
  return true;
}

void GPUTestConfig::ClearGPUVendor() {
  gpu_vendor_.clear();
}

GPUTestBotConfig::~GPUTestBotConfig() {
}

void GPUTestBotConfig::AddGPUVendor(uint32 gpu_vendor) {
  DCHECK_EQ(0u, GPUTestConfig::gpu_vendor().size());
  GPUTestConfig::AddGPUVendor(gpu_vendor);
}

bool GPUTestBotConfig::SetGPUInfo(const content::GPUInfo& gpu_info) {
  if (gpu_info.device_id == 0 || gpu_info.vendor_id == 0)
    return false;
  ClearGPUVendor();
  AddGPUVendor(gpu_info.vendor_id);
  set_gpu_device_id(gpu_info.device_id);
  return true;
}

bool GPUTestBotConfig::IsValid() const {
  switch (os()) {
    case kOsWinXP:
    case kOsWinVista:
    case kOsWin7:
    case kOsMacLeopard:
    case kOsMacSnowLeopard:
    case kOsMacLion:
    case kOsLinux:
    case kOsChromeOS:
      break;
    default:
      return false;
  }
  if (gpu_vendor().size() != 1 || gpu_vendor()[0] == 0)
    return false;
  if (gpu_device_id() == 0)
    return false;
  switch (build_type()) {
    case kBuildTypeRelease:
    case kBuildTypeDebug:
      break;
    default:
      return false;
  }
  return true;
}

bool GPUTestBotConfig::Matches(const GPUTestConfig& config) const {
  DCHECK(IsValid());
  DCHECK(config.IsValid());
  if (config.os() != kOsUnknown && (os() & config.os()) == 0)
    return false;
  if (config.gpu_vendor().size() > 0) {
    bool contained = false;
    for (size_t i = 0; i < config.gpu_vendor().size(); ++i) {
      if (config.gpu_vendor()[i] == gpu_vendor()[0]) {
        contained = true;
        break;
      }
    }
    if (!contained)
      return false;
  }
  if (config.gpu_device_id() != 0 &&
      gpu_device_id() != config.gpu_device_id())
    return false;
  if (config.build_type() != kBuildTypeUnknown &&
      (build_type() & config.build_type()) == 0)
    return false;
  return true;
}

bool GPUTestBotConfig::LoadCurrentConfig(const content::GPUInfo* gpu_info) {
  bool rt;
  if (gpu_info == NULL) {
    content::GPUInfo my_gpu_info;
    gpu_info_collector::CollectPreliminaryGraphicsInfo(&my_gpu_info);
    rt = SetGPUInfo(my_gpu_info);
  } else {
    rt = SetGPUInfo(*gpu_info);
  }
  set_os(GetCurrentOS());
  if (os() == kOsUnknown)
    rt = false;
#if defined(NDEBUG)
  set_build_type(kBuildTypeRelease);
#else
  set_build_type(kBuildTypeDebug);
#endif
  return rt;
}
