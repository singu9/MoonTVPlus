'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getTMDBImageUrl, getGenreNames, type TMDBItem } from '@/lib/tmdb.client';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface BannerCarouselProps {
  autoPlayInterval?: number; // 自动播放间隔（毫秒）
}

export default function BannerCarousel({ autoPlayInterval = 5000 }: BannerCarouselProps) {
  const router = useRouter();
  const [items, setItems] = useState<TMDBItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [skipNextAutoPlay, setSkipNextAutoPlay] = useState(false); // 跳过下一次自动播放
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isManualChange = useRef(false); // 标记是否为手动切换

  // LocalStorage 缓存配置
  const LOCALSTORAGE_KEY = 'tmdb_trending_cache';
  const LOCALSTORAGE_DURATION = 24 * 60 * 60 * 1000; // 1天

  // 跳转到播放页面
  const handlePlay = (title: string) => {
    router.push(`/play?title=${encodeURIComponent(title)}`);
  };

  // 获取热门内容
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        // 先检查 localStorage 缓存
        const cached = localStorage.getItem(LOCALSTORAGE_KEY);
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();
            
            // 如果缓存未过期，直接使用
            if (now - timestamp < LOCALSTORAGE_DURATION) {
              setItems(data);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            // 缓存解析失败，继续请求 API
            console.error('解析缓存数据失败:', e);
          }
        }

        // 从 API 获取数据
        const response = await fetch('/api/tmdb/trending');
        const result = await response.json();
        if (result.code === 200 && result.list.length > 0) {
          setItems(result.list);
          
          // 保存到 localStorage
          try {
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({
              data: result.list,
              timestamp: Date.now()
            }));
          } catch (e) {
            // localStorage 可能已满，忽略错误
            console.error('保存到 localStorage 失败:', e);
          }
        }
      } catch (error) {
        console.error('获取热门内容失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, [LOCALSTORAGE_KEY, LOCALSTORAGE_DURATION]);

  // 自动播放
  useEffect(() => {
    if (!items.length || isPaused) return;

    const timer = setInterval(() => {
      // 如果设置了跳过标志，跳过这一次自动播放
      if (skipNextAutoPlay) {
        setSkipNextAutoPlay(false);
        return;
      }
      
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [items.length, isPaused, autoPlayInterval, skipNextAutoPlay]);

  const goToPrevious = useCallback(() => {
    isManualChange.current = true;
    setSkipNextAutoPlay(true);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    setTimeout(() => {
      isManualChange.current = false;
    }, 100);
  }, [items.length]);

  const goToNext = useCallback(() => {
    isManualChange.current = true;
    setSkipNextAutoPlay(true);
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setTimeout(() => {
      isManualChange.current = false;
    }, 100);
  }, [items.length]);

  const goToSlide = useCallback((index: number) => {
    isManualChange.current = true;
    setSkipNextAutoPlay(true);
    setCurrentIndex(index);
    setTimeout(() => {
      isManualChange.current = false;
    }, 100);
  }, []);

  // 触摸事件处理
  const handleTouchStart = (e: React.TouchEvent) => {
    // 防止在手动切换过程中触发
    if (isManualChange.current) return;
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = 0; // 重置结束位置
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // 防止在手动切换过程中触发
    if (isManualChange.current) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    // 防止在手动切换过程中触发
    if (isManualChange.current) return;
    if (!touchStartX.current) return;
    
    // 如果有滑动，则执行滑动逻辑
    if (touchEndX.current !== 0) {
      const distance = touchStartX.current - touchEndX.current;
      const minSwipeDistance = 50; // 最小滑动距离

      if (Math.abs(distance) > minSwipeDistance) {
        if (distance > 0) {
          // 向左滑动，显示下一张
          goToNext();
        } else {
          // 向右滑动，显示上一张
          goToPrevious();
        }
      }
    }

    // 重置
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (isLoading) {
    return (
      <div className="relative w-full h-[200px] sm:h-[300px] md:h-[400px] lg:h-[500px] bg-gradient-to-b from-gray-800 to-gray-900 overflow-hidden animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return null;
  }

  const currentItem = items[currentIndex];

  return (
    <div
      className="relative w-full h-[200px] sm:h-[300px] md:h-[400px] lg:h-[500px] overflow-hidden group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        // 移动端点击整个轮播图跳转
        if (window.innerWidth < 768) {
          handlePlay(currentItem.title);
        }
      }}
    >
      {/* 背景图片 */}
      <div className="absolute inset-0">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={getTMDBImageUrl(item.backdrop_path || item.poster_path, 'original')}
              alt={item.title}
              fill
              className="object-cover"
              priority={index === 0}
              sizes="100vw"
            />
            {/* 渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          </div>
        ))}
      </div>

      {/* 内容信息 */}
      <div className="absolute inset-0 flex items-end p-8 md:p-12 pointer-events-none">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">
            {currentItem.title}
          </h2>
          
          <div className="flex items-center gap-2 md:gap-3 text-sm md:text-base text-white/90 flex-wrap">
            <span className="px-2 py-1 bg-yellow-500 text-black font-semibold rounded">
              {currentItem.vote_average.toFixed(1)}
            </span>
            {getGenreNames(currentItem.genre_ids, 3).map(genre => (
              <span key={genre} className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-sm">
                {genre}
              </span>
            ))}
            {currentItem.release_date && (
              <span>{currentItem.release_date}</span>
            )}
          </div>

          {/* PC端播放按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlay(currentItem.title);
            }}
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-gray-500/30 hover:bg-gray-500/50 backdrop-blur-sm text-white font-semibold rounded-lg transition-all pointer-events-auto"
          >
            <Play className="w-5 h-5 fill-white" />
            立即播放
          </button>

          {currentItem.overview && (
            <p className="text-sm md:text-base text-white/80 line-clamp-3 drop-shadow-md">
              {currentItem.overview}
            </p>
          )}
        </div>
      </div>

      {/* 左右切换按钮 - 只在桌面端显示 */}
      <button
        onClick={goToPrevious}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/60 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        aria-label="上一张"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>
      <button
        onClick={goToNext}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/60 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        aria-label="下一张"
      >
        <ChevronRight className="w-8 h-8" />
      </button>

      {/* 指示器 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-8 bg-white'
                : 'w-1.5 bg-white/50 hover:bg-white/80'
            }`}
            aria-label={`跳转到第 ${index + 1} 张`}
          />
        ))}
      </div>
    </div>
  );
}
