# Cache Directory

This directory stores persistent cache data to improve performance and reduce API calls.

## Purpose

The cache system stores computationally expensive results (like embeddings) and API responses to:

1. Reduce external API usage and costs
2. Improve response times for repeated queries
3. Allow offline operation for previously cached results

## Structure

The cache uses a sharded structure to avoid having too many files in a single directory:

```
cache/
  ├── embeddings/
  │   ├── aa/
  │   │   ├── cache_key_1  # Cache file
  │   │   └── cache_key_2  # Cache file
  │   └── ab/
  │       └── ...
  └── README.md
```

## Configuration

Cache behavior can be customized through environment variables:

```
CACHE_MAX_SIZE=10000      # Max items in memory cache
ENABLE_DISK_CACHE=true    # Enable disk caching
DISK_CACHE_PATH=cache     # Path for disk cache
DISK_CACHE_MAX_FILES=1000 # Max files in disk cache
DISK_CACHE_MAX_SIZE_MB=100 # Max size of disk cache in MB
```

## Cache Management

The cache system automatically:

1. Removes expired entries
2. Cleans up the oldest entries when the cache reaches size limits
3. Ensures thread-safe operations

## Vercel Deployment Notes

When deploying to Vercel, be aware that:

1. The `/tmp` directory is the only writable location
2. Data in `/tmp` may be cleared between function invocations
3. Consider setting `DISK_CACHE_PATH=/tmp/cache` in your Vercel environment variables

## Troubleshooting

If you encounter cache-related issues:

1. Check if the cache directory is writable
2. Verify that you have sufficient disk space
3. If cache corruption is suspected, manually delete the cache files
